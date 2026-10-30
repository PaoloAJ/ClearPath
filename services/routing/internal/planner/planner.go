// Package planner turns a trip request into ranked routes on the campus graph.
package planner

import (
	"errors"
	"fmt"

	"clearpath/routing/internal/graph"
	"clearpath/routing/internal/profiles"
)

// MaxSnapDistanceM is the farthest a start or end point can be from the map.
// Anything farther is outside the demo zone.
const MaxSnapDistanceM = 1000.0

var (
	ErrOutsideZone = errors.New("planner: point is outside the demo zone")
	ErrNoRoute     = errors.New("planner: no route found")
)

type Point struct {
	Lat, Lng float64
}

type Request struct {
	From, To Point
	Mode     profiles.Mode
	Blocked  map[int64]bool
}

type Route struct {
	Label       string
	FitsProfile bool
	Path        graph.Path
	Coords      [][2]float64
	DistanceM   float64
	DurationS   float64
	Notes       []string
}

// Plan snaps both ends to the graph and searches it.
func Plan(g *graph.Graph, req Request) ([]Route, error) {
	from, err := snap(g, req.From)
	if err != nil {
		return nil, fmt.Errorf("from: %w", err)
	}
	to, err := snap(g, req.To)
	if err != nil {
		return nil, fmt.Errorf("to: %w", err)
	}

	p, err := g.ShortestPath(from.ID, to.ID, profiles.CostFunc(req.Mode, profiles.Options{}), req.Blocked)
	if errors.Is(err, graph.ErrNoPath) {
		return nil, ErrNoRoute
	}
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}
	return []Route{{
		Label:       "For you",
		FitsProfile: true,
		Path:        p,
		Coords:      g.Coords(p),
		DistanceM:   p.LengthM,
		DurationS:   p.LengthM / profiles.Speed(req.Mode),
		Notes:       []string{},
	}}, nil
}

func snap(g *graph.Graph, pt Point) (graph.Node, error) {
	n, d, ok := g.Nearest(pt.Lat, pt.Lng)
	if !ok || d > MaxSnapDistanceM {
		return graph.Node{}, ErrOutsideZone
	}
	return n, nil
}
