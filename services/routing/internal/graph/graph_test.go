package graph

import "testing"

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

// TODO(routing): ShortestPath tests (blocked edges, excluded edges, no path) and
// graph data checks: connected graph, every elevator node has edges, no orphan nodes.
