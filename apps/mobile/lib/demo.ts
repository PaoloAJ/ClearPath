import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';
import { pathLength, pointAlong } from './navigation';
import type { LatLng } from './types';

// Demo mode (README → Demo mode). Only active when EXPO_PUBLIC_DEMO_MODE=true.
export const demoEnabled = env.demoMode;

/** Where demo trips start: Library West, south entrance. */
export const DEMO_START: LatLng = { lat: 29.6513, lng: -82.3430 };

/**
 * Where demo reports land: the mapped path by Century Tower (same point the smoke test uses).
 * report_alert rejects points more than 100 m from a path, so a presenter off campus still gets a report through.
 */
export const DEMO_REPORT_POINT: LatLng = { lat: 29.6488393, lng: -82.343574 };

export type DemoSpeed = 'walking' | 'rolling';

export const DEMO_SPEED_MPS: Record<DemoSpeed, number> = {
  walking: 1.3,
  rolling: 1.0,
};

const STEP_MS = 1000;

export interface DemoController {
  /** Move a fake location along the route geometry and report each step. */
  simulateWalk(path: LatLng[], speed: DemoSpeed, onStep: (pos: LatLng) => void): () => void;
  /** Drop a construction alert on the next segment of the route (triggers the R2 flow). */
  injectAlertAhead(nextSegment: [LatLng, LatLng]): Promise<void>;
  /** Flip an elevator between working and out. */
  toggleElevator(elevatorId: number): Promise<void>;
  /** Restore seed.sql state. */
  resetDemoData(): Promise<void>;
}

export function createDemoController(client: SupabaseClient): DemoController {
  async function call(fn: string, args: Record<string, unknown>) {
    const { error } = await client.rpc(fn, args);
    if (error) throw new Error(error.message);
  }
  return {
    simulateWalk(path, speed, onStep) {
      let walked = 0;
      const total = pathLength(path);
      const timer = setInterval(() => {
        walked = Math.min(total, walked + DEMO_SPEED_MPS[speed] * (STEP_MS / 1000));
        onStep(pointAlong(path, walked));
        if (walked >= total) clearInterval(timer);
      }, STEP_MS);
      return () => clearInterval(timer);
    },
    async injectAlertAhead([a, b]) {
      await call('demo_inject_alert', { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });
    },
    async toggleElevator(elevatorId) {
      await call('demo_toggle_elevator', { elevator_id: elevatorId });
    },
    async resetDemoData() {
      await call('demo_reset', {});
    },
  };
}
