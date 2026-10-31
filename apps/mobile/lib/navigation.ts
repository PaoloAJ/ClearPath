import { distanceMeters } from '@/lib/demo';
import type { LatLng, RouteOption } from '@/lib/types';

// The routing API returns geometry, not turn-by-turn steps, so instructions are derived here:
// consecutive segments within 30° of each other are one step.
const SAME_DIRECTION_DEG = 30;

export interface Step {
  /** Meters from the route start where this step begins and ends. */
  start: number;
  end: number;
  bearing: number;
}

export function routeLatLngs(route: RouteOption): LatLng[] {
  return route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

export function pathLength(path: LatLng[]): number {
  return path.slice(1).reduce((sum, point, i) => sum + distanceMeters(path[i]!, point), 0);
}

/** Compass bearing from a to b, 0 = north, clockwise. */
export function bearing(a: LatLng, b: LatLng): number {
  const dx = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dy = b.lat - a.lat;
  return (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
}

function turnBetween(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function buildSteps(path: LatLng[]): Step[] {
  const steps: Step[] = [];
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const length = distanceMeters(path[i - 1]!, path[i]!);
    if (length < 0.5) continue;
    const heading = bearing(path[i - 1]!, path[i]!);
    const last = steps[steps.length - 1];
    if (last && Math.abs(turnBetween(last.bearing, heading)) < SAME_DIRECTION_DEG) last.end = walked + length;
    else steps.push({ start: walked, end: walked + length, bearing: heading });
    walked += length;
  }
  return steps;
}

export function cardinal(deg: number): string {
  const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return names[Math.round(deg / 45) % 8]!;
}

function turnWord(degrees: number): string {
  const side = degrees < 0 ? 'left' : 'right';
  return Math.abs(degrees) < 60 ? `bear ${side}` : `turn ${side}`;
}

/** "Head north 130 m" / "then turn right", for the navy next-step header. */
export function nextInstruction(steps: Step[], walked: number, destination: string): { title: string; then: string; southward: boolean } {
  const index = steps.findIndex((step) => walked < step.end);
  const step = steps[index];
  if (!step) return { title: `Arrived at ${destination}`, then: 'Use the entrance on your route.', southward: false };
  const left = Math.max(1, Math.round((step.end - walked) / 10) * 10);
  const next = steps[index + 1];
  const direction = cardinal(step.bearing);
  return {
    title: `Head ${direction} ${left} m`,
    then: next ? `then ${turnWord(turnBetween(step.bearing, next.bearing))}` : `then arrive at ${destination}`,
    southward: direction.startsWith('south'),
  };
}

/**
 * Edge IDs still ahead, approximated by the share of distance walked. Edges come back in path order,
 * so the ones already passed are dropped from the front.
 */
export function remainingEdgeIds(route: RouteOption, walked: number, total: number): number[] {
  if (total <= 0) return route.edge_ids;
  const passed = Math.floor((walked / total) * route.edge_ids.length);
  return route.edge_ids.slice(Math.min(passed, route.edge_ids.length - 1));
}

/** How far along the path a position is, using its closest point on the path. */
export function distanceAlong(path: LatLng[], pos: LatLng): number {
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const length = distanceMeters(a, b);
    // Project in a local flat frame; fine at campus scale.
    const kx = Math.cos(a.lat * (Math.PI / 180));
    const abx = (b.lng - a.lng) * kx;
    const aby = b.lat - a.lat;
    const apx = (pos.lng - a.lng) * kx;
    const apy = pos.lat - a.lat;
    const t = abx * abx + aby * aby > 0 ? Math.min(1, Math.max(0, (apx * abx + apy * aby) / (abx * abx + aby * aby))) : 0;
    const closest = { lat: a.lat + aby * t, lng: a.lng + (b.lng - a.lng) * t };
    const distance = distanceMeters(closest, pos);
    if (distance < best.distance) best = { distance, along: walked + length * t };
    walked += length;
  }
  return best.along;
}
