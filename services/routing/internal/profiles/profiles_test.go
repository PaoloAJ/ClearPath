package profiles

import (
	"testing"

	"clearpath/routing/internal/graph"
)

func TestParse(t *testing.T) {
	for _, s := range []string{"wheelchair", "walking_aid", "bike", "scooter", "skateboard", "walking"} {
		if _, err := Parse(s); err != nil {
			t.Errorf("Parse(%q) = %v", s, err)
		}
	}
	if _, err := Parse("car"); err == nil {
		t.Error("Parse(\"car\") should fail")
	}
}

func TestCostFunc(t *testing.T) {
	flat := graph.Edge{LengthM: 100, Surface: graph.SurfacePaved, BikeOK: true}
	with := func(change func(*graph.Edge)) graph.Edge {
		e := flat
		change(&e)
		return e
	}
	stairs := with(func(e *graph.Edge) { e.Stairs = true })
	steep := with(func(e *graph.Edge) { e.SlopePct = 9 })
	uphill := with(func(e *graph.Edge) { e.SlopePct = 6.5 })
	brick := with(func(e *graph.Edge) { e.Surface = graph.SurfaceBrick })
	indoor := with(func(e *graph.Edge) { e.Indoor = true })
	noBikes := with(func(e *graph.Edge) { e.BikeOK = false })

	tests := []struct {
		name     string
		mode     Mode
		opts     Options
		edge     graph.Edge
		forward  bool
		wantOK   bool
		wantCost float64 // checked only when wantOK
	}{
		{"walking takes stairs at plain length", Walking, Options{}, stairs, true, true, 100},
		{"wheelchair never takes stairs", Wheelchair, Options{}, stairs, true, false, 0},
		{"AllowStairs lets wheelchair through", Wheelchair, Options{AllowStairs: true}, stairs, true, true, 100},
		{"wheelchair never takes slope over 8% uphill", Wheelchair, Options{}, steep, true, false, 0},
		{"wheelchair never takes slope over 8% downhill", Wheelchair, Options{}, steep, false, false, 0},
		{"wheelchair pays more going up than down", Wheelchair, Options{}, uphill, true, true, 300},
		{"wheelchair downhill penalty", Wheelchair, Options{}, uphill, false, true, 150},
		{"wheelchair avoids brick", Wheelchair, Options{}, brick, true, true, 200},
		{"walking aid pays heavily for stairs", WalkingAid, Options{}, stairs, true, true, 460},
		{"walking aid penalizes uphill only", WalkingAid, Options{}, uphill, false, true, 100},
		{"riders never go indoor", Bike, Options{}, indoor, true, false, 0},
		{"riders skip bike_ok=false", Scooter, Options{}, noBikes, true, false, 0},
		{"riders skip stairs", Skateboard, Options{}, stairs, true, false, 0},
		{"riders pay more on brick", Bike, Options{}, brick, true, true, 150},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cost, ok := CostFunc(tt.mode, tt.opts)(tt.edge, tt.forward)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && cost != tt.wantCost {
				t.Fatalf("cost = %v, want %v", cost, tt.wantCost)
			}
		})
	}
}
