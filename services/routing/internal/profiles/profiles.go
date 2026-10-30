// Package profiles turns a travel mode into an edge cost function.
// Thresholds are starting points from the README and are meant to be tuned in usability testing.
package profiles

import (
	"fmt"

	"clearpath/routing/internal/graph"
)

type Mode string

const (
	Wheelchair Mode = "wheelchair"
	WalkingAid Mode = "walking_aid"
	Bike       Mode = "bike"
	Scooter    Mode = "scooter"
	Skateboard Mode = "skateboard"
	Walking    Mode = "walking"
)

func Parse(s string) (Mode, error) {
	switch m := Mode(s); m {
	case Wheelchair, WalkingAid, Bike, Scooter, Skateboard, Walking:
		return m, nil
	}
	return "", fmt.Errorf("unknown profile %q", s)
}

func (m Mode) IsRider() bool {
	return m == Bike || m == Scooter || m == Skateboard
}

const (
	WheelchairMaxSlopePct     = 8.0 // excluded above this
	WheelchairPenaltySlopePct = 5.0 // penalized above this
	WalkingAidPenaltySlopePct = 6.0
)

// Options relax the profile to produce flagged alternatives (README → Routing).
type Options struct {
	AllowStairs bool
}

// CostFunc returns the edge cost function for mode.
//
//	wheelchair   exclude stairs, slope > 8%; penalize slope > 5%, brick/gravel/grass; prefer elevators, paved
//	walking_aid  penalize stairs (heavy), slope > 6%, long distances
//	riders       exclude indoor, stairs, bike_ok = false; penalize brick
//	walking      shortest
func CostFunc(mode Mode, opts Options) graph.CostFunc {
	// TODO(routing): implement the per-mode rules above. Walking is plain length for now.
	return func(e graph.Edge) (float64, bool) {
		return e.LengthM, true
	}
}
