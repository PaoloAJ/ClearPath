package api

import (
	"encoding/json"
	"net/http"

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
	if _, err := profiles.Parse(req.Profile); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	// TODO(routing): snap From/To with graph.Nearest, run ShortestPath with the profile's
	// CostFunc and barriers.Current().Blocked, then rerun with relaxed Options to build
	// flagged alternatives. Rank, label the best fit "For you", and explain each difference in Notes.
	writeError(w, http.StatusNotImplemented, "route search not implemented yet")
}

// POST /v1/routes/check
func (s *server) routesCheck(w http.ResponseWriter, r *http.Request) {
	var req RouteCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.AlertID == "" {
		writeError(w, http.StatusBadRequest, "alert_id is required")
		return
	}

	blocked, err := s.barriers.EdgesBlockedByAlert(r.Context(), req.AlertID, req.RemainingEdgeIDs)
	if err != nil {
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}
