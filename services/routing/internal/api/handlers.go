package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"

	"clearpath/routing/internal/planner"
	"clearpath/routing/internal/profiles"
)

func (s *server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// POST /v1/routes
func (s *server) routes(w http.ResponseWriter, r *http.Request) {
	var req RouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	mode, err := profiles.Parse(req.Profile)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	planned, err := planner.Plan(s.graphs.Current(), planner.Request{
		From:     planner.Point{Lat: req.From.Lat, Lng: req.From.Lng},
		To:       planner.Point{Lat: req.To.Lat, Lng: req.To.Lng},
		Mode:     mode,
		Barriers: s.barriers.Current(),
		Now:      time.Now(),
	})
	switch {
	case errors.Is(err, planner.ErrOutsideZone):
		writeError(w, http.StatusUnprocessableEntity, "start or destination is outside the demo zone")
		return
	case errors.Is(err, planner.ErrNoRoute):
		writeError(w, http.StatusUnprocessableEntity, "no route found between these points")
		return
	case err != nil:
		slog.Error("route search failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not plan route")
		return
	}

	resp := RouteResponse{Routes: make([]Route, 0, len(planned))}
	for i, p := range planned {
		resp.Routes = append(resp.Routes, toWire(i, p))
	}
	writeJSON(w, http.StatusOK, resp)
}

func toWire(i int, p planner.Route) Route {
	edges := p.Path.EdgeIDs
	if edges == nil {
		edges = []int64{}
	}
	notes := p.Notes
	if notes == nil {
		notes = []string{}
	}
	return Route{
		ID:          fmt.Sprintf("r%d", i+1),
		Label:       p.Label,
		FitsProfile: p.FitsProfile,
		DistanceM:   math.Round(p.DistanceM),
		DurationS:   math.Round(p.DurationS),
		Geometry:    LineString{Type: "LineString", Coordinates: p.Coords},
		EdgeIDs:     edges,
		Notes:       notes,
	}
}

// POST /v1/routes/check
func (s *server) routesCheck(w http.ResponseWriter, r *http.Request) {
	var req RouteCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if !isUUID(req.AlertID) {
		writeError(w, http.StatusBadRequest, "alert_id must be a UUID")
		return
	}

	blocked, err := s.barriers.EdgesBlockedByAlert(r.Context(), req.AlertID, req.RemainingEdgeIDs)
	if err != nil {
		slog.Error("route check failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not check alert")
		return
	}
	if blocked == nil {
		blocked = []int64{}
	}
	writeJSON(w, http.StatusOK, RouteCheckResponse{
		Affected:         len(blocked) > 0,
		BlockedEdgeIDs:   blocked,
		RerouteSuggested: len(blocked) > 0,
	})
}

// isUUID checks the 8-4-4-4-12 hex shape so a bad ID gets a 400 instead of a database error.
func isUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		switch {
		case i == 8 || i == 13 || i == 18 || i == 23:
			if c != '-' {
				return false
			}
		case !strings.ContainsRune("0123456789abcdefABCDEF", c):
			return false
		}
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}
