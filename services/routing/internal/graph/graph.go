// Package graph holds the campus graph in memory and searches it.
package graph

import (
	"errors"
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

// CostFunc prices an edge for one travel mode. ok=false excludes the edge.
type CostFunc func(e Edge) (cost float64, ok bool)

type Path struct {
	EdgeIDs []int64
	NodeIDs []int64
	LengthM float64
	Cost    float64
}

// Nearest returns the node closest to (lat, lng).
func (g *Graph) Nearest(lat, lng float64) (Node, bool) {
	// TODO(routing): snap to the nearest entrance/junction (skip elevator nodes).
	return Node{}, false
}

// ShortestPath runs A* from one node to another, skipping blocked edges.
func (g *Graph) ShortestPath(from, to int64, cost CostFunc, blocked map[int64]bool) (Path, error) {
	// TODO(routing): A* with a haversine heuristic scaled by the cheapest per-meter cost.
	return Path{}, ErrNoPath
}
