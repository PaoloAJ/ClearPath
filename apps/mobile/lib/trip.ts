import { useSyncExternalStore } from 'react';

import type { DemoBuilding } from '@/lib/alerts';
import type { LatLng, RouteOption, TravelMode } from '@/lib/types';

/** The trip being planned or followed. Lives in memory only; it isn't persisted. */
export interface Trip {
  from: LatLng;
  destination: DemoBuilding;
  mode: TravelMode;
  route: RouteOption;
  /** Set after a reroute, e.g. "Rerouted around construction". */
  rerouted: string | null;
}

let current: Trip | null = null;
// Meters walked on the current route. Updated on every step, so it doesn't notify subscribers.
let walked = 0;

export function getTripProgress(): number {
  return walked;
}

export function setTripProgress(meters: number): void {
  walked = meters;
}
const listeners = new Set<() => void>();

export function getTrip(): Trip | null {
  return current;
}

export function setTrip(trip: Trip | null): void {
  if (trip?.route !== current?.route) walked = 0;
  current = trip;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useTrip(): Trip | null {
  return useSyncExternalStore(subscribe, getTrip, getTrip);
}
