package planner

import (
	"os"
	"testing"
	"time"

	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
	"clearpath/routing/internal/profiles"
)

// BenchmarkPlanCampus times a wheelchair trip across the checked-in map, from the
// first node to the last. The goal is well under 200 ms (SlowRequestThreshold).
func BenchmarkPlanCampus(b *testing.B) {
	dir := os.Getenv("CAMPUS_DATA_DIR")
	if dir == "" {
		dir = "../../../../data/campus"
	}
	g, err := graph.ReadGeoJSON(dir)
	if err != nil {
		b.Fatal(err)
	}
	var first, last graph.Node
	for _, n := range g.Nodes {
		if n.Kind == graph.NodeElevator {
			continue
		}
		if first.ID == 0 || n.ID < first.ID {
			first = n
		}
		if n.ID > last.ID {
			last = n
		}
	}
	req := Request{
		From: Point{first.Lat, first.Lng}, To: Point{last.Lat, last.Lng},
		Mode: profiles.Wheelchair, Barriers: &barriers.Snapshot{}, Now: time.Now(),
	}
	for b.Loop() {
		if _, err := Plan(g, req); err != nil {
			b.Fatal(err)
		}
	}
}
