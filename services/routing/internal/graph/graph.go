// Package graph holds the campus graph in memory and searches it.
package graph

import (
	"container/heap"
	"errors"
	"math"
)

// ErrNoPath is returned when no route exists under the given cost function and blocks.
var ErrNoPath = errors.New("graph: no path")

type NodeKind string

const (
	NodeEntrance NodeKind = "entrance"
	NodeJunction NodeKind = "junction"
	NodeElevator NodeKind = "elevator"
)

type Node struct {
	ID       int64
	Lat, Lng float64
	Kind     NodeKind
	Building *string
	Floor    *int
}

type Surface string

const (
	SurfacePaved  Surface = "paved"
	SurfaceBrick  Surface = "brick"
	SurfaceGravel Surface = "gravel"
	SurfaceGrass  Surface = "grass"
)

// Edge is undirected; Coords run from Source to Target as [lng, lat] pairs.
type Edge struct {
	ID         int64
	Source     int64
	Target     int64
	Coords     [][2]float64
	LengthM    float64
	SlopePct   float64 // signed grade, positive uphill from Source to Target
	Stairs     bool
	Surface    Surface
	Indoor     bool
	BikeOK     bool
	ElevatorID *int64
}

// Grade returns the slope in percent for the direction of travel; positive is uphill.
func (e Edge) Grade(forward bool) float64 {
	if forward {
		return e.SlopePct
	}
	return -e.SlopePct
}

// Other returns the endpoint of e that isn't node.
func (e Edge) Other(node int64) int64 {
	if e.Source == node {
		return e.Target
	}
	return e.Source
}

type Graph struct {
	Nodes map[int64]Node
	Edges map[int64]Edge
	adj   map[int64][]int64 // node ID → incident edge IDs
}

func New(nodes []Node, edges []Edge) *Graph {
	g := &Graph{
		Nodes: make(map[int64]Node, len(nodes)),
		Edges: make(map[int64]Edge, len(edges)),
		adj:   make(map[int64][]int64, len(nodes)),
	}
	for _, n := range nodes {
		g.Nodes[n.ID] = n
	}
	for _, e := range edges {
		g.Edges[e.ID] = e
		g.adj[e.Source] = append(g.adj[e.Source], e.ID)
		g.adj[e.Target] = append(g.adj[e.Target], e.ID)
	}
	return g
}

// Incident returns the IDs of edges touching node id.
func (g *Graph) Incident(id int64) []int64 {
	return g.adj[id]
}

// CostFunc prices an edge for one travel mode. forward is true when walking Source→Target.
// ok=false excludes the edge. Costs must be non-negative.
type CostFunc func(e Edge, forward bool) (cost float64, ok bool)

type Path struct {
	EdgeIDs []int64
	NodeIDs []int64
	LengthM float64
	Cost    float64
}

// Nearest returns the entrance or junction closest to (lat, lng) and its distance in meters.
// Elevator nodes are skipped: a trip starts at a door or on a path, not inside a shaft.
func (g *Graph) Nearest(lat, lng float64) (Node, float64, bool) {
	var best Node
	bestD := math.Inf(1)
	for _, n := range g.Nodes {
		if n.Kind == NodeElevator {
			continue
		}
		d := Haversine(lat, lng, n.Lat, n.Lng)
		// Tie-break on ID so results don't depend on map order.
		if d < bestD || (d == bestD && n.ID < best.ID) {
			best, bestD = n, d
		}
	}
	return best, bestD, !math.IsInf(bestD, 1)
}

// ShortestPath runs A* from one node to another, skipping blocked edges and edges cost excludes.
func (g *Graph) ShortestPath(from, to int64, cost CostFunc, blocked map[int64]bool) (Path, error) {
	if _, ok := g.Nodes[from]; !ok {
		return Path{}, ErrNoPath
	}
	goal, ok := g.Nodes[to]
	if !ok {
		return Path{}, ErrNoPath
	}

	// Straight-line distance times the cheapest cost per straight-line meter of any usable
	// edge never overestimates, so the heuristic stays admissible for every cost function.
	perMeter := g.minCostPerMeter(cost, blocked)
	h := func(id int64) float64 {
		n := g.Nodes[id]
		return Haversine(n.Lat, n.Lng, goal.Lat, goal.Lng) * perMeter
	}

	type via struct{ edge, node int64 }
	dist := map[int64]float64{from: 0}
	prev := map[int64]via{}
	done := map[int64]bool{}
	open := &frontier{{node: from, f: h(from)}}

	for open.Len() > 0 {
		cur := heap.Pop(open).(item)
		if done[cur.node] {
			continue
		}
		if cur.node == to {
			break
		}
		done[cur.node] = true

		for _, eid := range g.adj[cur.node] {
			if blocked[eid] {
				continue
			}
			e := g.Edges[eid]
			c, ok := cost(e, e.Source == cur.node)
			if !ok {
				continue
			}
			next := e.Other(cur.node)
			if done[next] {
				continue
			}
			d := dist[cur.node] + c
			if old, seen := dist[next]; seen && d >= old {
				continue
			}
			dist[next] = d
			prev[next] = via{edge: eid, node: cur.node}
			heap.Push(open, item{node: next, f: d + h(next)})
		}
	}

	total, ok := dist[to]
	if !ok {
		return Path{}, ErrNoPath
	}
	p := Path{Cost: total, NodeIDs: []int64{to}}
	for n := to; n != from; {
		v := prev[n]
		p.EdgeIDs = append(p.EdgeIDs, v.edge)
		p.NodeIDs = append(p.NodeIDs, v.node)
		p.LengthM += g.Edges[v.edge].LengthM
		n = v.node
	}
	reverse(p.EdgeIDs)
	reverse(p.NodeIDs)
	return p, nil
}

// Coords returns the path geometry as [lng, lat] pairs, flipping edges walked Target→Source.
func (g *Graph) Coords(p Path) [][2]float64 {
	var out [][2]float64
	for i, eid := range p.EdgeIDs {
		e := g.Edges[eid]
		pts := e.Coords
		if e.Source != p.NodeIDs[i] {
			pts = make([][2]float64, len(e.Coords))
			for j, c := range e.Coords {
				pts[len(pts)-1-j] = c
			}
		}
		// Consecutive edges share their joining point; keep it once.
		if len(out) > 0 && len(pts) > 0 && out[len(out)-1] == pts[0] {
			pts = pts[1:]
		}
		out = append(out, pts...)
	}
	if len(out) == 0 && len(p.NodeIDs) > 0 {
		n := g.Nodes[p.NodeIDs[0]]
		out = [][2]float64{{n.Lng, n.Lat}}
	}
	return out
}

func (g *Graph) minCostPerMeter(cost CostFunc, blocked map[int64]bool) float64 {
	best := math.Inf(1)
	for _, e := range g.Edges {
		if blocked[e.ID] {
			continue
		}
		s, t := g.Nodes[e.Source], g.Nodes[e.Target]
		straight := Haversine(s.Lat, s.Lng, t.Lat, t.Lng)
		if straight < 1e-6 {
			continue // vertical edges (elevators) cover no ground
		}
		for _, fwd := range []bool{true, false} {
			if c, ok := cost(e, fwd); ok && c/straight < best {
				best = c / straight
			}
		}
	}
	if math.IsInf(best, 1) {
		return 0
	}
	return best
}

const earthRadiusM = 6371008.8

// Haversine returns the great-circle distance in meters between two points.
func Haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const rad = math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLng := (lng2 - lng1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(a)))
}

type item struct {
	node int64
	f    float64
}

// frontier is a min-heap on f, tie-broken by node ID so paths are deterministic.
type frontier []item

func (q frontier) Len() int { return len(q) }
func (q frontier) Less(i, j int) bool {
	if q[i].f != q[j].f {
		return q[i].f < q[j].f
	}
	return q[i].node < q[j].node
}
func (q frontier) Swap(i, j int) { q[i], q[j] = q[j], q[i] }
func (q *frontier) Push(x any)   { *q = append(*q, x.(item)) }
func (q *frontier) Pop() any {
	old := *q
	it := old[len(old)-1]
	*q = old[:len(old)-1]
	return it
}

func reverse[T any](s []T) {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
}
