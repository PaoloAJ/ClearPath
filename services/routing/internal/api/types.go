package api

// Wire types for the routing API. apps/mobile/lib/types.ts mirrors these; change both together.

type LatLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type RouteRequest struct {
	From    LatLng `json:"from"`
	To      LatLng `json:"to"`
	Profile string `json:"profile"`
}

type LineString struct {
	Type        string       `json:"type"` // always "LineString"
	Coordinates [][2]float64 `json:"coordinates"`
}

type Route struct {
	ID          string     `json:"id"`
	Label       string     `json:"label"` // "For you", "Fastest", ...
	FitsProfile bool       `json:"fits_profile"`
	DistanceM   float64    `json:"distance_m"`
	DurationS   float64    `json:"duration_s"`
	Geometry    LineString `json:"geometry"`
	EdgeIDs     []int64    `json:"edge_ids"`
	Notes       []string   `json:"notes"`
}

type RouteResponse struct {
	Routes []Route `json:"routes"`
}

type RouteCheckRequest struct {
	RemainingEdgeIDs []int64 `json:"remaining_edge_ids"`
	AlertID          string  `json:"alert_id"`
}

type RouteCheckResponse struct {
	Affected         bool    `json:"affected"`
	BlockedEdgeIDs   []int64 `json:"blocked_edge_ids"`
	RerouteSuggested bool    `json:"reroute_suggested"`
}

type errorResponse struct {
	Error string `json:"error"`
}
