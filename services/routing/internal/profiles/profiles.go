// Package profiles turns a travel mode into an edge cost function.
// Thresholds are starting points from the README and are meant to be tuned in usability testing.
package profiles

import (
	"fmt"
	"math"

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
	WheelchairMaxSlopePct     = 8.0 // excluded above this, uphill or down
	WheelchairPenaltySlopePct = 5.0 // penalized above this
	WalkingAidPenaltySlopePct = 6.0
)

// Cost multipliers and fixed costs. A fixed cost is counted as extra meters.
const (
	WheelchairUphillFactor   = 3.0 // steep uphill is hard work
	WheelchairDownhillFactor = 1.5 // steep downhill is harder to control
	WheelchairRoughFactor    = 2.0 // brick, gravel, grass
	WalkingAidStairsFactor   = 4.0
	WalkingAidStairsExtraM   = 60.0 // every flight costs this much on top
	WalkingAidUphillFactor   = 2.0
	RiderBrickFactor         = 1.5
	ElevatorExtraM           = 20.0 // time spent waiting for the elevator
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
	switch {
	case mode == Wheelchair:
		return func(e graph.Edge, forward bool) (float64, bool) {
			grade := e.Grade(forward)
			if (e.Stairs && !opts.AllowStairs) || math.Abs(grade) > WheelchairMaxSlopePct {
				return 0, false
			}
			c := e.LengthM
			if grade > WheelchairPenaltySlopePct {
				c *= WheelchairUphillFactor
			} else if grade < -WheelchairPenaltySlopePct {
				c *= WheelchairDownhillFactor
			}
			if e.Surface != graph.SurfacePaved {
				c *= WheelchairRoughFactor
			}
			return c + elevatorExtra(e), true
		}
	case mode == WalkingAid:
		// Distance is the base cost, so a stairs-free detour only wins when it's short.
		return func(e graph.Edge, forward bool) (float64, bool) {
			c := e.LengthM
			if e.Stairs {
				c = c*WalkingAidStairsFactor + WalkingAidStairsExtraM
			}
			if e.Grade(forward) > WalkingAidPenaltySlopePct {
				c *= WalkingAidUphillFactor
			}
			return c + elevatorExtra(e), true
		}
	case mode.IsRider():
		return func(e graph.Edge, _ bool) (float64, bool) {
			if e.Indoor || !e.BikeOK || (e.Stairs && !opts.AllowStairs) {
				return 0, false
			}
			c := e.LengthM
			if e.Surface == graph.SurfaceBrick {
				c *= RiderBrickFactor
			}
			return c, true
		}
	}
	return func(e graph.Edge, _ bool) (float64, bool) {
		return e.LengthM + elevatorExtra(e), true
	}
}

func elevatorExtra(e graph.Edge) float64 {
	if e.ElevatorID != nil {
		return ElevatorExtraM
	}
	return 0
}

// Travel speeds in meters per second, used for duration_s.
const (
	WalkingSpeedMps    = 1.3
	WalkingAidSpeedMps = 0.9
	WheelchairSpeedMps = 1.1
	BikeSpeedMps       = 4.5
	ScooterSpeedMps    = 4.0
	SkateboardSpeedMps = 3.0
)

// Speed returns the typical travel speed for mode in meters per second.
func Speed(mode Mode) float64 {
	switch mode {
	case Wheelchair:
		return WheelchairSpeedMps
	case WalkingAid:
		return WalkingAidSpeedMps
	case Bike:
		return BikeSpeedMps
	case Scooter:
		return ScooterSpeedMps
	case Skateboard:
		return SkateboardSpeedMps
	}
	return WalkingSpeedMps
}
