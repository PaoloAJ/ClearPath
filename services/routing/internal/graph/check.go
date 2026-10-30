package graph

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// Check lists problems that would break routing: edges that point at missing nodes,
// nodes with no edges (elevators included), and parts of the map that can't be reached.
func (g *Graph) Check() error {
	var problems []string
	for _, e := range g.Edges {
		for _, end := range []int64{e.Source, e.Target} {
			if _, ok := g.Nodes[end]; !ok {
				problems = append(problems, fmt.Sprintf("edge %d points at missing node %d", e.ID, end))
			}
		}
	}
	for id, n := range g.Nodes {
		if len(g.adj[id]) == 0 {
			problems = append(problems, fmt.Sprintf("%s node %d has no edges", n.Kind, id))
		}
	}
	if len(g.Nodes) > 0 {
		start := slices.Min(nodeIDs(g))
		if reached := g.reachable(start); reached < len(g.Nodes) {
			problems = append(problems, fmt.Sprintf("%d of %d nodes can't be reached from node %d",
				len(g.Nodes)-reached, len(g.Nodes), start))
		}
	}
	if len(problems) == 0 {
		return nil
	}
	slices.Sort(problems)
	return errors.New(strings.Join(problems, "; "))
}

func (g *Graph) reachable(start int64) int {
	seen := map[int64]bool{start: true}
	queue := []int64{start}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for _, eid := range g.adj[cur] {
			next := g.Edges[eid].Other(cur)
			if _, ok := g.Nodes[next]; ok && !seen[next] {
				seen[next] = true
				queue = append(queue, next)
			}
		}
	}
	return len(seen)
}

func nodeIDs(g *Graph) []int64 {
	ids := make([]int64, 0, len(g.Nodes))
	for id := range g.Nodes {
		ids = append(ids, id)
	}
	return ids
}

// ReadGeoJSON builds a graph from nodes.geojson and edges.geojson in dir (data/campus).
// The service loads from Postgres; this is for tests and benchmarks on the real map.
func ReadGeoJSON(dir string) (*Graph, error) {
	var nodesFile struct {
		Features []struct {
			Properties struct {
				ID       int64    `json:"id"`
				Kind     NodeKind `json:"kind"`
				Building *string  `json:"building"`
				Floor    *int     `json:"floor"`
			} `json:"properties"`
			Geometry struct {
				Coordinates [2]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	var edgesFile struct {
		Features []struct {
			Properties struct {
				ID         int64   `json:"id"`
				Source     int64   `json:"source"`
				Target     int64   `json:"target"`
				SlopePct   float64 `json:"slope_pct"`
				Stairs     bool    `json:"stairs"`
				Surface    Surface `json:"surface"`
				Indoor     bool    `json:"indoor"`
				BikeOK     bool    `json:"bike_ok"`
				ElevatorID *int64  `json:"elevator_id"`
			} `json:"properties"`
			Geometry struct {
				Coordinates [][2]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"features"`
	}
	if err := readJSON(filepath.Join(dir, "nodes.geojson"), &nodesFile); err != nil {
		return nil, err
	}
	if err := readJSON(filepath.Join(dir, "edges.geojson"), &edgesFile); err != nil {
		return nil, err
	}

	nodes := make([]Node, 0, len(nodesFile.Features))
	for _, f := range nodesFile.Features {
		p, c := f.Properties, f.Geometry.Coordinates
		nodes = append(nodes, Node{ID: p.ID, Lat: c[1], Lng: c[0], Kind: p.Kind, Building: p.Building, Floor: p.Floor})
	}
	edges := make([]Edge, 0, len(edgesFile.Features))
	for _, f := range edgesFile.Features {
		p, c := f.Properties, f.Geometry.Coordinates
		var length float64
		for i := 1; i < len(c); i++ {
			length += Haversine(c[i-1][1], c[i-1][0], c[i][1], c[i][0])
		}
		edges = append(edges, Edge{
			ID: p.ID, Source: p.Source, Target: p.Target, Coords: c, LengthM: length,
			SlopePct: p.SlopePct, Stairs: p.Stairs, Surface: p.Surface, Indoor: p.Indoor,
			BikeOK: p.BikeOK, ElevatorID: p.ElevatorID,
		})
	}
	return New(nodes, edges), nil
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("parse %s: %w", path, err)
	}
	return nil
}
