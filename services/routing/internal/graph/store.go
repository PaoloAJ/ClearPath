package graph

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Store keeps the current graph and reloads it from Postgres on an interval.
type Store struct {
	pool    *pgxpool.Pool
	current atomic.Pointer[Graph]
}

func NewStore(pool *pgxpool.Pool) *Store {
	s := &Store{pool: pool}
	s.current.Store(New(nil, nil))
	return s
}

func (s *Store) Current() *Graph {
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
			if err := s.Reload(ctx); err != nil {
				slog.Error("graph reload failed", "err", err)
			}
		}
	}
}

func (s *Store) Reload(ctx context.Context) error {
	nodes, err := s.loadNodes(ctx)
	if err != nil {
		return err
	}
	edges, err := s.loadEdges(ctx)
	if err != nil {
		return err
	}
	g := New(nodes, edges)
	// Still serve a graph with problems, since most routes will work, but say so loudly.
	if err := g.Check(); err != nil {
		slog.Warn("graph check failed", "err", err)
	}
	s.current.Store(g)
	slog.Info("graph loaded", "nodes", len(nodes), "edges", len(edges))
	return nil
}

func (s *Store) loadNodes(ctx context.Context) ([]Node, error) {
	rows, err := s.pool.Query(ctx, `
		select id, st_y(geom::geometry), st_x(geom::geometry), kind, building, floor
		from nodes`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []Node
	for rows.Next() {
		var n Node
		if err := rows.Scan(&n.ID, &n.Lat, &n.Lng, &n.Kind, &n.Building, &n.Floor); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

func (s *Store) loadEdges(ctx context.Context) ([]Edge, error) {
	rows, err := s.pool.Query(ctx, `
		select id, source, target, st_asgeojson(geom)::jsonb -> 'coordinates',
		       length_m, slope_pct, stairs, surface, indoor, bike_ok, elevator_id
		from edges`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var edges []Edge
	for rows.Next() {
		var e Edge
		var coords []byte
		if err := rows.Scan(&e.ID, &e.Source, &e.Target, &coords, &e.LengthM, &e.SlopePct,
			&e.Stairs, &e.Surface, &e.Indoor, &e.BikeOK, &e.ElevatorID); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(coords, &e.Coords); err != nil {
			return nil, err
		}
		edges = append(edges, e)
	}
	return edges, rows.Err()
}
