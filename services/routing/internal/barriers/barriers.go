// Package barriers turns active alerts and out-of-service elevators into blocked edges.
package barriers

import (
	"context"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Snapshot is the set of edges that routing must avoid right now.
type Snapshot struct {
	Blocked   map[int64]bool
	Reasons   map[int64]Reason   // why each blocked edge is blocked
	Elevators map[int64]Elevator // every elevator, for route notes
	LoadedAt  time.Time
}

// Reason says why an edge is blocked: an alert of some type, or a broken elevator.
type Reason struct {
	AlertType  string
	ElevatorID *int64
}

type Elevator struct {
	ID             int64
	Name           string // "Marston, east elevator"
	Building       string
	Status         string // working | out | unconfirmed
	Verified       bool
	LastReportedAt *time.Time
}

type Store struct {
	pool    *pgxpool.Pool
	current atomic.Pointer[Snapshot]
}

func NewStore(pool *pgxpool.Pool) *Store {
	s := &Store{pool: pool}
	s.current.Store(&Snapshot{Blocked: map[int64]bool{}, Reasons: map[int64]Reason{}, Elevators: map[int64]Elevator{}})
	return s
}

func (s *Store) Current() *Snapshot {
	return s.current.Load()
}

func (s *Store) Run(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.Refresh(ctx); err != nil {
				slog.Error("barrier refresh failed", "err", err)
			}
		}
	}
}

// Refresh blocks every edge that intersects an active alert polygon or rides an elevator that is out.
func (s *Store) Refresh(ctx context.Context) error {
	blocked, reasons, err := s.loadBlocked(ctx)
	if err != nil {
		return fmt.Errorf("load blocked edges: %w", err)
	}
	elevators, err := s.loadElevators(ctx)
	if err != nil {
		return fmt.Errorf("load elevators: %w", err)
	}
	s.current.Store(&Snapshot{Blocked: blocked, Reasons: reasons, Elevators: elevators, LoadedAt: time.Now()})
	return nil
}

func (s *Store) loadBlocked(ctx context.Context) (map[int64]bool, map[int64]Reason, error) {
	rows, err := s.pool.Query(ctx, `
		select e.id, a.type, null::bigint from public.edges e
		join public.alerts a on st_intersects(e.geom, a.geom)
		where a.resolved_at is null and a.expires_at > now()
		union all
		select e.id, null, e.elevator_id from public.edges e
		join public.elevators el on el.id = e.elevator_id
		where el.status = 'out'`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	blocked := map[int64]bool{}
	reasons := map[int64]Reason{}
	for rows.Next() {
		var id int64
		var alertType *string
		var r Reason
		if err := rows.Scan(&id, &alertType, &r.ElevatorID); err != nil {
			return nil, nil, err
		}
		if alertType != nil {
			r.AlertType = *alertType
		}
		// One reason per edge is enough for a note; keep the first.
		if !blocked[id] {
			reasons[id] = r
		}
		blocked[id] = true
	}
	return blocked, reasons, rows.Err()
}

func (s *Store) loadElevators(ctx context.Context) (map[int64]Elevator, error) {
	rows, err := s.pool.Query(ctx, `
		select id, name, building, status, verified, last_reported_at
		from public.elevators`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	elevators := map[int64]Elevator{}
	for rows.Next() {
		var el Elevator
		if err := rows.Scan(&el.ID, &el.Name, &el.Building, &el.Status, &el.Verified, &el.LastReportedAt); err != nil {
			return nil, err
		}
		elevators[el.ID] = el
	}
	return elevators, rows.Err()
}

// EdgesBlockedByAlert returns the subset of edgeIDs that intersect one alert (for /v1/routes/check).
func (s *Store) EdgesBlockedByAlert(ctx context.Context, alertID string, edgeIDs []int64) ([]int64, error) {
	// TODO(routing): query edges where id = any($2) and st_intersects with the alert's polygon.
	return nil, nil
}
