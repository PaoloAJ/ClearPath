// Package planner turns a trip request into ranked routes on the campus graph.
package planner

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"slices"
	"time"

	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
	"clearpath/routing/internal/profiles"
)

// MaxSnapDistanceM is the farthest a start or end point can be from the map.
// Anything farther is outside the demo zone.
const MaxSnapDistanceM = 1000.0

// NearbyBuildingM is how close a building must be to name it in a note ("Stairs near Marston").
const NearbyBuildingM = 150.0

// MaxRoutes is the most routes one request returns.
const MaxRoutes = 3

const (
	LabelForYou      = "For you"
	LabelFastest     = "Fastest"
	LabelAlternative = "Alternative"
)

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
	Barriers *barriers.Snapshot
	Now      time.Time
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

// Plan snaps both ends to the graph, searches it a few ways, and returns up to MaxRoutes routes.
// The best route that fits the profile comes first as "For you". Routes that break the profile
// or cross a barrier are kept only when they are shorter, and their notes say why.
func Plan(g *graph.Graph, req Request) ([]Route, error) {
	from, err := snap(g, req.From)
	if err != nil {
		return nil, fmt.Errorf("from: %w", err)
	}
	to, err := snap(g, req.To)
	if err != nil {
		return nil, fmt.Errorf("to: %w", err)
	}
	snapshot := req.Barriers
	if snapshot == nil {
		snapshot = &barriers.Snapshot{}
	}

	// Search the profile as is, then with stairs allowed, then plain shortest with no barriers.
	searches := []struct {
		cost    graph.CostFunc
		blocked map[int64]bool
	}{
		{profiles.CostFunc(req.Mode, profiles.Options{}), snapshot.Blocked},
		{profiles.CostFunc(req.Mode, profiles.Options{AllowStairs: true}), snapshot.Blocked},
		{profiles.CostFunc(profiles.Walking, profiles.Options{}), nil},
	}
	c := checker{g: g, mode: req.Mode, snap: snapshot, now: req.Now}
	var fits, misfits []Route
	var seen [][]int64
	for _, s := range searches {
		p, err := g.ShortestPath(from.ID, to.ID, s.cost, s.blocked)
		if errors.Is(err, graph.ErrNoPath) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("search: %w", err)
		}
		if slices.ContainsFunc(seen, func(ids []int64) bool { return slices.Equal(ids, p.EdgeIDs) }) {
			continue
		}
		seen = append(seen, p.EdgeIDs)

		ok, notes := c.check(p)
		r := Route{
			FitsProfile: ok,
			Path:        p,
			Coords:      g.Coords(p),
			DistanceM:   p.LengthM,
			DurationS:   p.LengthM / profiles.Speed(req.Mode),
			Notes:       notes,
		}
		if ok {
			fits = append(fits, r)
		} else {
			misfits = append(misfits, r)
		}
	}
	return rank(fits, misfits)
}

func rank(fits, misfits []Route) ([]Route, error) {
	slices.SortStableFunc(misfits, func(a, b Route) int { return cmp.Compare(a.DistanceM, b.DistanceM) })

	var out []Route
	if len(fits) > 0 {
		best := fits[0]
		best.Label = LabelForYou
		out = append(out, best)
		// A route that breaks the profile is only worth showing if it's shorter.
		misfits = slices.DeleteFunc(misfits, func(r Route) bool { return r.DistanceM >= best.DistanceM })
	}
	for i, r := range misfits {
		r.Label = LabelAlternative
		if i == 0 {
			r.Label = LabelFastest
		}
		if len(fits) == 0 {
			r.Notes = append([]string{"No route fits your profile right now"}, r.Notes...)
		}
		out = append(out, r)
	}
	if len(out) == 0 {
		return nil, ErrNoRoute
	}
	return out[:min(len(out), MaxRoutes)], nil
}

// checker decides whether a found path fits the profile and writes its notes.
type checker struct {
	g    *graph.Graph
	mode profiles.Mode
	snap *barriers.Snapshot
	now  time.Time
}

func (c checker) check(p graph.Path) (bool, []string) {
	strict := profiles.CostFunc(c.mode, profiles.Options{})
	fits := true
	notes := []string{}
	add := func(n string) {
		if !slices.Contains(notes, n) {
			notes = append(notes, n)
		}
	}
	for i, eid := range p.EdgeIDs {
		e := c.g.Edges[eid]
		forward := e.Source == p.NodeIDs[i]
		if c.snap.Blocked[eid] {
			fits = false
			add(c.blockedNote(e))
			continue
		}
		if _, ok := strict(e, forward); !ok {
			fits = false
			add(c.profileNote(e, forward))
			continue
		}
		// Allowed but worth knowing about.
		if e.Stairs && c.mode == profiles.WalkingAid {
			add(c.at("Stairs", e))
		}
		if e.ElevatorID != nil {
			add(c.elevatorNote(*e.ElevatorID))
		}
	}
	return fits, notes
}

func (c checker) profileNote(e graph.Edge, forward bool) string {
	switch {
	case e.Stairs:
		return c.at("Stairs", e)
	case c.mode == profiles.Wheelchair && math.Abs(e.Grade(forward)) > profiles.WheelchairMaxSlopePct:
		return c.near(fmt.Sprintf("Steep slope (%.0f%%)", math.Abs(e.Grade(forward))), e)
	case c.mode.IsRider() && e.Indoor:
		return c.place("Goes indoors through ", e, "Goes indoors")
	case c.mode.IsRider() && !e.BikeOK:
		return c.place("No bikes allowed near ", e, "Part of this route doesn't allow bikes")
	}
	return "Part of this route doesn't fit your profile"
}

func (c checker) blockedNote(e graph.Edge) string {
	r := c.snap.Reasons[e.ID]
	if r.ElevatorID != nil {
		if el, ok := c.snap.Elevators[*r.ElevatorID]; ok {
			return el.Name + " is out of service"
		}
		return "An elevator on this route is out of service"
	}
	return c.near(alertWords(r.AlertType)+" reported", e)
}

// elevatorNote reads like "Uses Marston, east elevator (working, verified 20 min ago)".
func (c checker) elevatorNote(id int64) string {
	el, ok := c.snap.Elevators[id]
	if !ok {
		return "Uses an elevator"
	}
	status := el.Status
	if status == "unconfirmed" {
		status = "status not confirmed"
	}
	when := "no recent reports"
	if el.LastReportedAt != nil {
		verb := "reported"
		if el.Verified {
			verb = "verified"
		}
		when = verb + " " + ago(c.now.Sub(*el.LastReportedAt))
	}
	return fmt.Sprintf("Uses %s (%s, %s)", el.Name, status, when)
}

func (c checker) at(what string, e graph.Edge) string {
	return c.place(what+" at ", e, what+" on this route")
}

func (c checker) near(what string, e graph.Edge) string {
	return c.place(what+" near ", e, what+" on this route")
}

// place names the building at either end of e, or the closest one, and falls back when none is close.
func (c checker) place(prefix string, e graph.Edge, fallback string) string {
	for _, id := range []int64{e.Source, e.Target} {
		if b := c.g.Nodes[id].Building; b != nil {
			return prefix + *b
		}
	}
	mid := c.g.Nodes[e.Source]
	best, bestD := "", NearbyBuildingM
	for _, n := range c.g.Nodes {
		if n.Building == nil {
			continue
		}
		if d := graph.Haversine(mid.Lat, mid.Lng, n.Lat, n.Lng); d < bestD {
			best, bestD = *n.Building, d
		}
	}
	if best == "" {
		return fallback
	}
	return prefix + best
}

func alertWords(alertType string) string {
	switch alertType {
	case "construction":
		return "Construction"
	case "elevator_out":
		return "Elevator outage"
	case "blocked_path":
		return "Blocked path"
	case "flooding":
		return "Flooding"
	case "broken_ramp":
		return "Broken ramp"
	}
	return "Barrier"
}

func ago(d time.Duration) string {
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%d min ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d h ago", int(d.Hours()))
	}
	return fmt.Sprintf("%d days ago", int(d.Hours()/24))
}

func snap(g *graph.Graph, pt Point) (graph.Node, error) {
	n, d, ok := g.Nearest(pt.Lat, pt.Lng)
	if !ok || d > MaxSnapDistanceM {
		return graph.Node{}, ErrOutsideZone
	}
	return n, nil
}
