package planner

import (
	"slices"
	"testing"
	"time"

	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
	"clearpath/routing/internal/profiles"
)

var now = time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)

// campus is a tiny map from Library West (1) to Marston (3).
//
//	1 ─e1─ 2 ─e2 (stairs)─ 3        short way, through Turlington (2)
//	       │               │
//	       e3     e6 (ramp)│        step-free ways: the elevator (e4, e5) or the long ramp (e6)
//	       │               │
//	       4 ─e4─ 5 ─e5────┘        5 is the Marston elevator, e5 rides it
func campus(withStairs bool) *graph.Graph {
	name := func(s string) *string { return &s }
	elevator := int64(7)
	nodes := []graph.Node{
		{ID: 1, Lat: 29.6510, Lng: -82.3440, Kind: graph.NodeEntrance, Building: name("Library West")},
		{ID: 2, Lat: 29.6501, Lng: -82.3440, Kind: graph.NodeEntrance, Building: name("Turlington")},
		{ID: 3, Lat: 29.6492, Lng: -82.3440, Kind: graph.NodeEntrance, Building: name("Marston")},
		{ID: 4, Lat: 29.6501, Lng: -82.3432, Kind: graph.NodeJunction},
		{ID: 5, Lat: 29.6494, Lng: -82.3432, Kind: graph.NodeElevator, Building: name("Marston")},
	}
	edges := []graph.Edge{
		{ID: 1, Source: 1, Target: 2, LengthM: 100},
		{ID: 3, Source: 2, Target: 4, LengthM: 80},
		{ID: 4, Source: 4, Target: 5, LengthM: 80},
		{ID: 5, Source: 5, Target: 3, LengthM: 10, ElevatorID: &elevator, Indoor: true},
		{ID: 6, Source: 4, Target: 3, LengthM: 300, SlopePct: 4},
	}
	if withStairs {
		edges = append(edges, graph.Edge{ID: 2, Source: 2, Target: 3, LengthM: 100, Stairs: true})
	}
	for i := range edges {
		if edges[i].Surface == "" {
			edges[i].Surface, edges[i].BikeOK = graph.SurfacePaved, true
		}
	}
	return graph.New(nodes, edges)
}

func snapshot(elevatorStatus string) *barriers.Snapshot {
	reported := now.Add(-20 * time.Minute)
	s := &barriers.Snapshot{
		Blocked: map[int64]bool{},
		Reasons: map[int64]barriers.Reason{},
		Elevators: map[int64]barriers.Elevator{7: {
			ID: 7, Name: "Marston, east elevator", Building: "Marston",
			Status: elevatorStatus, Verified: true, LastReportedAt: &reported,
		}},
	}
	if elevatorStatus == "out" {
		id := int64(7)
		s.Blocked[5] = true
		s.Reasons[5] = barriers.Reason{ElevatorID: &id}
	}
	return s
}

type want struct {
	label string
	fits  bool
	edges []int64
	notes []string
}

func TestPlan(t *testing.T) {
	tests := []struct {
		name       string
		mode       profiles.Mode
		withStairs bool
		elevator   string
		want       []want
	}{
		{
			name: "wheelchair takes the elevator, stairs route is flagged", mode: profiles.Wheelchair,
			withStairs: true, elevator: "working",
			want: []want{
				{LabelForYou, true, []int64{1, 3, 4, 5}, []string{"Uses Marston, east elevator (working, verified 20 min ago)"}},
				{LabelFastest, false, []int64{1, 2}, []string{"Stairs at Turlington"}},
			},
		},
		{
			name: "wheelchair takes the ramp when the elevator is out", mode: profiles.Wheelchair,
			elevator: "out",
			want: []want{
				{LabelForYou, true, []int64{1, 3, 6}, []string{}},
				{LabelFastest, false, []int64{1, 3, 4, 5}, []string{"Marston, east elevator is out of service"}},
			},
		},
		{
			name: "walking takes the stairs and nothing else is shorter", mode: profiles.Walking,
			withStairs: true, elevator: "working",
			want: []want{
				{LabelForYou, true, []int64{1, 2}, []string{}},
			},
		},
		{
			name: "bike has no fitting route", mode: profiles.Bike,
			withStairs: true, elevator: "out",
			want: []want{
				{LabelFastest, false, []int64{1, 2}, []string{"No route fits your profile right now", "Stairs at Turlington"}},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Bikes can't use e6 here, so the only ways are stairs, the indoor elevator, or nothing.
			g := campus(tt.withStairs)
			if tt.mode.IsRider() {
				e := g.Edges[6]
				e.BikeOK = false
				g.Edges[6] = e
			}
			routes, err := Plan(g, Request{
				From: Point{29.6510, -82.3440}, To: Point{29.6492, -82.3440},
				Mode: tt.mode, Barriers: snapshot(tt.elevator), Now: now,
			})
			if err != nil {
				t.Fatal(err)
			}
			if len(routes) != len(tt.want) {
				t.Fatalf("got %d routes, want %d: %+v", len(routes), len(tt.want), routes)
			}
			for i, w := range tt.want {
				r := routes[i]
				if r.Label != w.label || r.FitsProfile != w.fits || !slices.Equal(r.Path.EdgeIDs, w.edges) || !slices.Equal(r.Notes, w.notes) {
					t.Errorf("route %d = %q fits=%v edges=%v notes=%q\nwant %q fits=%v edges=%v notes=%q",
						i, r.Label, r.FitsProfile, r.Path.EdgeIDs, r.Notes, w.label, w.fits, w.edges, w.notes)
				}
				if !r.FitsProfile && len(r.Notes) == 0 {
					t.Errorf("route %d doesn't fit but has no notes", i)
				}
			}
		})
	}
}
