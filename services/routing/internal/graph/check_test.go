package graph

import (
	"os"
	"strings"
	"testing"
)

// campusDir is the checked-in demo-zone map. CAMPUS_DATA_DIR points somewhere else, e.g. a draft map.
func campusDir() string {
	if dir := os.Getenv("CAMPUS_DATA_DIR"); dir != "" {
		return dir
	}
	return "../../../../data/campus"
}

func TestCampusDataPassesCheck(t *testing.T) {
	g, err := ReadGeoJSON(campusDir())
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Nodes) == 0 {
		t.Fatal("campus graph is empty")
	}
	if err := g.Check(); err != nil {
		t.Fatalf("campus graph: %v", err)
	}
}

func TestCheck(t *testing.T) {
	tests := []struct {
		name  string
		nodes []Node
		edges []Edge
		want  string // part of the error, or "" for no error
	}{
		{"connected", []Node{{ID: 1}, {ID: 2}}, []Edge{{ID: 1, Source: 1, Target: 2}}, ""},
		{"orphan node", []Node{{ID: 1}, {ID: 2}, {ID: 3, Kind: NodeJunction}},
			[]Edge{{ID: 1, Source: 1, Target: 2}}, "junction node 3 has no edges"},
		{"elevator with no edges", []Node{{ID: 1}, {ID: 2}, {ID: 3, Kind: NodeElevator}},
			[]Edge{{ID: 1, Source: 1, Target: 2}}, "elevator node 3 has no edges"},
		{"two separate pieces", []Node{{ID: 1}, {ID: 2}, {ID: 3}, {ID: 4}},
			[]Edge{{ID: 1, Source: 1, Target: 2}, {ID: 2, Source: 3, Target: 4}}, "2 of 4 nodes can't be reached"},
		{"missing node", []Node{{ID: 1}}, []Edge{{ID: 1, Source: 1, Target: 9}}, "edge 1 points at missing node 9"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := New(tt.nodes, tt.edges).Check()
			if tt.want == "" {
				if err != nil {
					t.Fatalf("Check() = %v, want nil", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("Check() = %v, want it to mention %q", err, tt.want)
			}
		})
	}
}
