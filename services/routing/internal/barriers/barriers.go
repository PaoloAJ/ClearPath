// Package barriers turns active alerts and out-of-service elevators into blocked edges.
package barriers

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Snapshot is the set of edges that routing must avoid right now.
type Snapshot struct {
	Blocked  map[int64]bool
	LoadedAt time.Time
}

type Store struct {
	pool    *pgxpool.Pool
	current atomic.Pointer[Snapshot]
}

func NewStore(pool *pgxpool.Pool) *Store {
	s := &Store{pool: pool}
	s.current.Store(&Snapshot{Blocked: map[int64]bool{}})
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
	rows, err := s.pool.Query(ctx, `
		select e.id from edges e
		join alerts a on st_intersects(e.geom, a.geom)
		where a.resolved_at is null and a.expires_at > now()
		union
		select e.id from edges e
		join elevators el on el.id = e.elevator_id
		where el.status = 'out'`)
	if err != nil {
		return err
	}
	defer rows.Close()

	blocked := map[int64]bool{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return err
		}
		blocked[id] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	s.current.Store(&Snapshot{Blocked: blocked, LoadedAt: time.Now()})
	return nil
}

// EdgesBlockedByAlert returns the subset of edgeIDs that intersect one alert (for /v1/routes/check).
func (s *Store) EdgesBlockedByAlert(ctx context.Context, alertID string, edgeIDs []int64) ([]int64, error) {
	// TODO(routing): query edges where id = any($2) and st_intersects with the alert's polygon.
	return nil, nil
}
