package graph

import (
	"errors"
	"math"
	"slices"
	"testing"
)

func TestNewBuildsAdjacency(t *testing.T) {
	g := New(
		[]Node{{ID: 1}, {ID: 2}, {ID: 3}},
		[]Edge{{ID: 10, Source: 1, Target: 2}, {ID: 11, Source: 2, Target: 3}},
	)
	if got := len(g.Incident(2)); got != 2 {
		t.Fatalf("node 2 incident edges = %d, want 2", got)
	}
	if got := len(g.Incident(1)); got != 1 {
		t.Fatalf("node 1 incident edges = %d, want 1", got)
	}
}

// diamond is a small graph with a short route over stairs and a longer step-free one.
//
//	    2
//	  /   \      1→2→4 is short and has stairs on 2→4 (edge 12)
//	1       4    1→3→4 is longer and step-free
//	  \   /
//	    3 ── 5   (elevator node 5 hangs off 3)
func diamond() *Graph {
	nodes := []Node{
		{ID: 1, Lat: 29.6500, Lng: -82.3450, Kind: NodeEntrance},
		{ID: 2, Lat: 29.6505, Lng: -82.3440, Kind: NodeJunction},
		{ID: 3, Lat: 29.6490, Lng: -82.3440, Kind: NodeJunction},
		{ID: 4, Lat: 29.6500, Lng: -82.3430, Kind: NodeEntrance},
		{ID: 5, Lat: 29.6490, Lng: -82.3440, Kind: NodeElevator},
	}
	edges := []Edge{
		edgeBetween(nodes, 11, 1, 2),
		edgeBetween(nodes, 12, 2, 4),
		edgeBetween(nodes, 13, 1, 3),
		edgeBetween(nodes, 14, 3, 4),
		edgeBetween(nodes, 15, 3, 5),
	}
	edges[1].Stairs = true
	return New(nodes, edges)
}

func edgeBetween(nodes []Node, id, s, t int64) Edge {
	var a, b Node
	for _, n := range nodes {
		if n.ID == s {
			a = n
		}
		if n.ID == t {
			b = n
		}
	}
	return Edge{
		ID: id, Source: s, Target: t,
		Coords:  [][2]float64{{a.Lng, a.Lat}, {b.Lng, b.Lat}},
		LengthM: Haversine(a.Lat, a.Lng, b.Lat, b.Lng),
		Surface: SurfacePaved, BikeOK: true,
	}
}

func length(e Edge, _ bool) (float64, bool) { return e.LengthM, true }

func noStairs(e Edge, _ bool) (float64, bool) { return e.LengthM, !e.Stairs }

func TestShortestPath(t *testing.T) {
	tests := []struct {
		name      string
		from, to  int64
		cost      CostFunc
		blocked   map[int64]bool
		wantEdges []int64
		wantNodes []int64
		wantErr   error
	}{
		{name: "shortest takes stairs", from: 1, to: 4, cost: length,
			wantEdges: []int64{11, 12}, wantNodes: []int64{1, 2, 4}},
		{name: "excluded edge is skipped", from: 1, to: 4, cost: noStairs,
			wantEdges: []int64{13, 14}, wantNodes: []int64{1, 3, 4}},
		{name: "blocked edge is skipped", from: 1, to: 4, cost: length, blocked: map[int64]bool{11: true},
			wantEdges: []int64{13, 14}, wantNodes: []int64{1, 3, 4}},
		{name: "walks edges backwards", from: 4, to: 1, cost: length,
			wantEdges: []int64{12, 11}, wantNodes: []int64{4, 2, 1}},
		{name: "no path when every route is blocked", from: 1, to: 4, cost: noStairs,
			blocked: map[int64]bool{14: true}, wantErr: ErrNoPath},
		{name: "same node is an empty path", from: 1, to: 1, cost: length,
			wantNodes: []int64{1}},
		{name: "unknown node", from: 1, to: 99, cost: length, wantErr: ErrNoPath},
	}
	g := diamond()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := g.ShortestPath(tt.from, tt.to, tt.cost, tt.blocked)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if !slices.Equal(p.EdgeIDs, tt.wantEdges) {
				t.Errorf("edges = %v, want %v", p.EdgeIDs, tt.wantEdges)
			}
			if !slices.Equal(p.NodeIDs, tt.wantNodes) {
				t.Errorf("nodes = %v, want %v", p.NodeIDs, tt.wantNodes)
			}
			var wantLen float64
			for _, id := range tt.wantEdges {
				wantLen += g.Edges[id].LengthM
			}
			if math.Abs(p.LengthM-wantLen) > 1e-9 || math.Abs(p.Cost-wantLen) > 1e-9 {
				t.Errorf("length, cost = %v, %v, want %v", p.LengthM, p.Cost, wantLen)
			}
		})
	}
}

func TestShortestPathPassesDirection(t *testing.T) {
	g := diamond()
	// Only allow edges walked Source→Target: 4→1 must fail, 1→4 must succeed.
	forwardOnly := func(e Edge, forward bool) (float64, bool) { return e.LengthM, forward }
	if _, err := g.ShortestPath(4, 1, forwardOnly, nil); !errors.Is(err, ErrNoPath) {
		t.Fatalf("4→1 err = %v, want ErrNoPath", err)
	}
	if _, err := g.ShortestPath(1, 4, forwardOnly, nil); err != nil {
		t.Fatalf("1→4 err = %v", err)
	}
}

func TestShortestPathMatchesDijkstraOnGrid(t *testing.T) {
	// A* must return the optimal cost even when costs vary a lot per edge.
	g := grid(12)
	cost := func(e Edge, _ bool) (float64, bool) {
		return e.LengthM * float64(1+e.ID%5), true
	}
	for _, to := range []int64{12*12 - 1, 77, 5} {
		p, err := g.ShortestPath(0, to, cost, nil)
		if err != nil {
			t.Fatal(err)
		}
		if want := dijkstra(g, 0, to, cost); math.Abs(p.Cost-want) > 1e-6 {
			t.Errorf("to %d: cost = %v, want %v", to, p.Cost, want)
		}
	}
}

func TestEdgeGrade(t *testing.T) {
	e := Edge{SlopePct: 4}
	if e.Grade(true) != 4 || e.Grade(false) != -4 {
		t.Fatalf("Grade = %v, %v, want 4, -4", e.Grade(true), e.Grade(false))
	}
}

func TestNearestSkipsElevators(t *testing.T) {
	g := diamond()
	// Node 5 (elevator) sits exactly on node 3; Nearest must pick 3.
	n, d, ok := g.Nearest(29.6490, -82.3440)
	if !ok || n.ID != 3 || d > 0.01 {
		t.Fatalf("Nearest = %d (%.2f m, %v), want node 3", n.ID, d, ok)
	}
	n, _, _ = g.Nearest(29.6501, -82.3449)
	if n.ID != 1 {
		t.Fatalf("Nearest = %d, want 1", n.ID)
	}
	if _, _, ok := New(nil, nil).Nearest(0, 0); ok {
		t.Fatal("Nearest on an empty graph should report ok=false")
	}
}

func TestCoordsFlipsReversedEdges(t *testing.T) {
	g := diamond()
	p, err := g.ShortestPath(4, 1, length, nil)
	if err != nil {
		t.Fatal(err)
	}
	got := g.Coords(p)
	n4, n2, n1 := g.Nodes[4], g.Nodes[2], g.Nodes[1]
	want := [][2]float64{{n4.Lng, n4.Lat}, {n2.Lng, n2.Lat}, {n1.Lng, n1.Lat}}
	if !slices.Equal(got, want) {
		t.Fatalf("coords = %v, want %v", got, want)
	}
}

func TestHaversine(t *testing.T) {
	// 0.001° of latitude is about 111 m.
	if d := Haversine(29.65, -82.34, 29.651, -82.34); math.Abs(d-111.2) > 0.5 {
		t.Fatalf("Haversine = %.2f, want ≈111.2", d)
	}
}

// grid builds an n×n lattice of junctions about 10 m apart.
func grid(n int) *Graph {
	var nodes []Node
	for r := range n {
		for c := range n {
			nodes = append(nodes, Node{ID: int64(r*n + c), Lat: 29.64 + float64(r)*0.0001, Lng: -82.35 + float64(c)*0.0001, Kind: NodeJunction})
		}
	}
	var edges []Edge
	id := int64(1)
	for r := range n {
		for c := range n {
			here := int64(r*n + c)
			if c+1 < n {
				edges = append(edges, edgeBetween(nodes, id, here, here+1))
				id++
			}
			if r+1 < n {
				edges = append(edges, edgeBetween(nodes, id, here, here+int64(n)))
				id++
			}
		}
	}
	return New(nodes, edges)
}

func dijkstra(g *Graph, from, to int64, cost CostFunc) float64 {
	dist := map[int64]float64{from: 0}
	done := map[int64]bool{}
	for {
		cur, best := int64(-1), math.Inf(1)
		for id, d := range dist {
			if !done[id] && d < best {
				cur, best = id, d
			}
		}
		if cur < 0 {
			return math.Inf(1)
		}
		if cur == to {
			return best
		}
		done[cur] = true
		for _, eid := range g.Incident(cur) {
			e := g.Edges[eid]
			c, ok := cost(e, e.Source == cur)
			if !ok {
				continue
			}
			next := e.Other(cur)
			if old, seen := dist[next]; !seen || best+c < old {
				dist[next] = best + c
			}
		}
	}
}
