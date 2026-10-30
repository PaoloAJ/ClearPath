// Package api serves the routing HTTP API.
package api

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
)

type GraphSource interface {
	Current() *graph.Graph
}

type BarrierSource interface {
	Current() *barriers.Snapshot
	EdgesBlockedByAlert(ctx context.Context, alertID string, edgeIDs []int64) ([]int64, error)
}

type server struct {
	graphs   GraphSource
	barriers BarrierSource
}

// NewRouter wires the routes. requireAuth guards everything except /healthz.
func NewRouter(graphs GraphSource, blocks BarrierSource, requireAuth func(http.Handler) http.Handler) http.Handler {
	s := &server{graphs: graphs, barriers: blocks}

	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(middleware.Timeout(10 * time.Second))
	r.Use(logSlow)

	r.Get("/healthz", s.healthz)

	r.Route("/v1", func(r chi.Router) {
		r.Use(requireAuth)
		r.Post("/routes", s.routes)
		r.Post("/routes/check", s.routesCheck)
	})
	return r
}

// SlowRequestThreshold is the response time goal on the demo graph. Slower requests get logged.
const SlowRequestThreshold = 200 * time.Millisecond

func logSlow(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if took := time.Since(start); took > SlowRequestThreshold {
			slog.Warn("slow request", "method", r.Method, "path", r.URL.Path, "took", took)
		}
	})
}
