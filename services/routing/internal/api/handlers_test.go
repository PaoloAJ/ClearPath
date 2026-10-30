package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
)

type fakeGraphs struct{}

func (fakeGraphs) Current() *graph.Graph { return graph.New(nil, nil) }

type fakeBarriers struct{ blocked []int64 }

func (f fakeBarriers) Current() *barriers.Snapshot {
	return &barriers.Snapshot{Blocked: map[int64]bool{}}
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

func TestRoutesCheckReportsAffected(t *testing.T) {
	h := NewRouter(fakeGraphs{}, fakeBarriers{blocked: []int64{48}}, noAuth)
	body := `{"remaining_edge_ids":[47,48,52],"alert_id":"6f1c"}`
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/routes/check", strings.NewReader(body)))
	want := `{"affected":true,"blocked_edge_ids":[48],"reroute_suggested":true}`
	if got := strings.TrimSpace(rec.Body.String()); got != want {
		t.Fatalf("body = %s, want %s", got, want)
	}
}
