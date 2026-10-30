// Shared app types. Row types mirror supabase/migrations; API types mirror
// services/routing/internal/api. Change them in the same PR as the schema or API.

export type TravelMode = 'wheelchair' | 'walking_aid' | 'bike' | 'scooter' | 'skateboard' | 'walking';

export type AlertType =
  | 'construction'
  | 'elevator_out'
  | 'blocked_path'
  | 'flooding'
  | 'broken_ramp'
  | 'other';

export type ElevatorStatus = 'working' | 'out' | 'unconfirmed';

export type VoteKind = 'still_there' | 'cleared';

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface GeoLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface Profile {
  user_id: string;
  mode: TravelMode;
  temp_mode: TravelMode | null;
  temp_until: string | null; // ISO date
  haptics_only: boolean;
  updated_at: string;
}

export interface Elevator {
  id: number;
  building: string;
  name: string;
  node_id: number;
  status: ElevatorStatus;
  verified: boolean;
  last_reported_at: string | null;
}

/**
 * Row from the `alerts_feed` view. PostgREST returns geography columns as WKB,
 * so the view exposes the polygon as GeoJSON plus a center point for the pin.
 */
export interface AlertFeedItem {
  id: string;
  type: AlertType;
  geom: GeoPolygon;
  lat: number;
  lng: number;
  created_by: string;
  verified: boolean;
  photo_path: string | null;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  confirmations: number;
  cleared_votes: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// Routing API (README → Routing → API)

export interface RouteRequest {
  from: LatLng;
  to: LatLng;
  profile: TravelMode;
}

export interface RouteOption {
  id: string;
  label: string;
  fits_profile: boolean;
  distance_m: number;
  duration_s: number;
  geometry: GeoLineString;
  edge_ids: number[];
  notes: string[];
}

export interface RouteResponse {
  routes: RouteOption[];
}

export interface RouteCheckRequest {
  remaining_edge_ids: number[];
  alert_id: string;
}

export interface RouteCheckResponse {
  affected: boolean;
  blocked_edge_ids: number[];
  reroute_suggested: boolean;
}

/** The mode routing should use today: temp_mode through temp_until (inclusive), else mode. */
export function effectiveMode(profile: Pick<Profile, 'mode' | 'temp_mode' | 'temp_until'>, now = new Date()): TravelMode {
  if (profile.temp_mode && profile.temp_until && profile.temp_until >= localISODate(now)) {
    return profile.temp_mode;
  }
  return profile.mode;
}

function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
