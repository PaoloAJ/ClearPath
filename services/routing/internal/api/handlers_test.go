package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
)

type fakeGraphs struct{ g *graph.Graph }

func (f fakeGraphs) Current() *graph.Graph {
	if f.g == nil {
		return graph.New(nil, nil)
	}
	return f.g
}

type fakeBarriers struct {
	snap    *barriers.Snapshot
	blocked []int64
}

func (f fakeBarriers) Current() *barriers.Snapshot {
	if f.snap == nil {
		return &barriers.Snapshot{Blocked: map[int64]bool{}}
	}
	return f.snap
}

func (f fakeBarriers) EdgesBlockedByAlert(context.Context, string, []int64) ([]int64, error) {
	return f.blocked, nil
}

func noAuth(next http.Handler) http.Handler { return next }

func TestHealthz(t *testing.T) {
	h := NewRouter(fakeGraphs{}, fakeBarriers{}, noAuth)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestRoutesRejectsUnknownProfile(t *testing.T) {
	h := NewRouter(fakeGraphs{}, fakeBarriers{}, noAuth)
	body := `{"from":{"lat":29.65,"lng":-82.34},"to":{"lat":29.64,"lng":-82.34},"profile":"car"}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/routes", strings.NewReader(body)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestRoutesCheck(t *testing.T) {
	const id = "6f1c2a9e-3b4d-4c5e-8f90-1a2b3c4d5e6f"
	tests := []struct {
		name     string
		blocked  []int64
		body     string
		wantCode int
		wantBody string
	}{
		{"affected", []int64{48}, `{"remaining_edge_ids":[47,48,52],"alert_id":"` + id + `"}`,
			http.StatusOK, `{"affected":true,"blocked_edge_ids":[48],"reroute_suggested":true}`},
		{"not affected", nil, `{"remaining_edge_ids":[47],"alert_id":"` + id + `"}`,
			http.StatusOK, `{"affected":false,"blocked_edge_ids":[],"reroute_suggested":false}`},
		{"bad alert id", nil, `{"remaining_edge_ids":[47],"alert_id":"6f1c"}`,
			http.StatusBadRequest, `{"error":"alert_id must be a UUID"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := NewRouter(fakeGraphs{}, fakeBarriers{blocked: tt.blocked}, noAuth)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/routes/check", strings.NewReader(tt.body)))
			if got := strings.TrimSpace(rec.Body.String()); rec.Code != tt.wantCode || got != tt.wantBody {
				t.Fatalf("got %d %s, want %d %s", rec.Code, got, tt.wantCode, tt.wantBody)
			}
		})
	}
}

// line is three nodes in a row, roughly 110 m apart, joined by edges 1 (1→2) and 2 (2→3).
func line() *graph.Graph {
	return graph.New(
		[]graph.Node{
			{ID: 1, Lat: 29.6500, Lng: -82.3430, Kind: graph.NodeEntrance},
			{ID: 2, Lat: 29.6490, Lng: -82.3430, Kind: graph.NodeJunction},
			{ID: 3, Lat: 29.6480, Lng: -82.3430, Kind: graph.NodeEntrance},
		},
		[]graph.Edge{
			{ID: 1, Source: 1, Target: 2, LengthM: 111, Surface: graph.SurfacePaved, BikeOK: true,
				Coords: [][2]float64{{-82.3430, 29.6500}, {-82.3431, 29.6495}, {-82.3430, 29.6490}}},
			{ID: 2, Source: 3, Target: 2, LengthM: 111, Surface: graph.SurfacePaved, BikeOK: true,
				Coords: [][2]float64{{-82.3430, 29.6480}, {-82.3430, 29.6490}}},
		},
	)
}

func postRoutes(t *testing.T, g *graph.Graph, body string) *httptest.ResponseRecorder {
	t.Helper()
	return postRoutesWith(t, g, fakeBarriers{}, body)
}

func postRoutesWith(t *testing.T, g *graph.Graph, b fakeBarriers, body string) *httptest.ResponseRecorder {
	t.Helper()
	h := NewRouter(fakeGraphs{g: g}, b, noAuth)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/routes", strings.NewReader(body)))
	return rec
}

func TestRoutesReturnsOneRoute(t *testing.T) {
	rec := postRoutes(t, line(), `{"from":{"lat":29.65001,"lng":-82.343},"to":{"lat":29.648,"lng":-82.343},"profile":"walking"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var resp RouteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Routes) != 1 {
		t.Fatalf("routes = %d, want 1", len(resp.Routes))
	}
	r := resp.Routes[0]
	if r.ID != "r1" || r.Label != "For you" || !r.FitsProfile {
		t.Errorf("route = %+v", r)
	}
	if r.DistanceM != 222 {
		t.Errorf("distance_m = %v, want 222", r.DistanceM)
	}
	if r.DurationS <= 0 {
		t.Errorf("duration_s = %v, want > 0", r.DurationS)
	}
	if r.Geometry.Type != "LineString" {
		t.Errorf("geometry type = %q", r.Geometry.Type)
	}
	// Edge 2 runs 3→2, so it must be flipped, and the shared point at node 2 appears once.
	want := [][2]float64{{-82.3430, 29.6500}, {-82.3431, 29.6495}, {-82.3430, 29.6490}, {-82.3430, 29.6480}}
	if len(r.Geometry.Coordinates) != len(want) {
		t.Fatalf("coordinates = %v, want %v", r.Geometry.Coordinates, want)
	}
	for i := range want {
		if r.Geometry.Coordinates[i] != want[i] {
			t.Fatalf("coordinates = %v, want %v", r.Geometry.Coordinates, want)
		}
	}
	if len(r.EdgeIDs) != 2 || r.EdgeIDs[0] != 1 || r.EdgeIDs[1] != 2 {
		t.Errorf("edge_ids = %v, want [1 2]", r.EdgeIDs)
	}
	if r.Notes == nil {
		t.Error("notes must be [] not null")
	}
}

func TestRoutesErrors(t *testing.T) {
	disconnected := graph.New(
		[]graph.Node{{ID: 1, Lat: 29.65, Lng: -82.343}, {ID: 2, Lat: 29.648, Lng: -82.343}}, nil)
	tests := []struct {
		name string
		g    *graph.Graph
		body string
		want int
	}{
		{"bad json", line(), `{`, http.StatusBadRequest},
		{"outside demo zone", line(), `{"from":{"lat":37.77,"lng":-122.41},"to":{"lat":29.648,"lng":-82.343},"profile":"walking"}`, http.StatusUnprocessableEntity},
		{"empty graph", nil, `{"from":{"lat":29.65,"lng":-82.343},"to":{"lat":29.648,"lng":-82.343},"profile":"walking"}`, http.StatusUnprocessableEntity},
		{"no path", disconnected, `{"from":{"lat":29.65,"lng":-82.343},"to":{"lat":29.648,"lng":-82.343},"profile":"walking"}`, http.StatusUnprocessableEntity},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := postRoutes(t, tt.g, tt.body); rec.Code != tt.want {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.want, rec.Body)
			}
		})
	}
}

func TestRoutesAvoidBlockedEdges(t *testing.T) {
	// Add a shortcut from 1 to 3, then block it with a live barrier.
	g := line()
	edges := []graph.Edge{g.Edges[1], g.Edges[2], {ID: 9, Source: 1, Target: 3, LengthM: 150,
		Surface: graph.SurfacePaved, BikeOK: true, Coords: [][2]float64{{-82.3430, 29.6500}, {-82.3430, 29.6480}}}}
	nodes := []graph.Node{g.Nodes[1], g.Nodes[2], g.Nodes[3]}
	g = graph.New(nodes, edges)
	body := `{"from":{"lat":29.65,"lng":-82.343},"to":{"lat":29.648,"lng":-82.343},"profile":"walking"}`

	for _, tt := range []struct {
		name    string
		blocked map[int64]bool
		want    []int64
	}{
		{"takes the shortcut when clear", nil, []int64{9}},
		{"goes around when blocked", map[int64]bool{9: true}, []int64{1, 2}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			rec := postRoutesWith(t, g, fakeBarriers{snap: &barriers.Snapshot{Blocked: tt.blocked}}, body)
			var resp RouteResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || len(resp.Routes) == 0 {
				t.Fatalf("status %d, body %s", rec.Code, rec.Body)
			}
			if got := resp.Routes[0].EdgeIDs; !slices.Equal(got, tt.want) {
				t.Fatalf("edge_ids = %v, want %v", got, tt.want)
			}
		})
	}
}
