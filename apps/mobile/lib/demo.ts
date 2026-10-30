import { env } from './env';
import type { LatLng } from './types';

// Demo mode (README → Demo mode). Only active when EXPO_PUBLIC_DEMO_MODE=true.
export const demoEnabled = env.demoMode;

export type DemoSpeed = 'walking' | 'rolling';

export const DEMO_SPEED_MPS: Record<DemoSpeed, number> = {
  walking: 1.3,
  rolling: 1.0,
};

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

// TODO(frontend): implement the controller. injectAlertAhead / toggleElevator / resetDemoData
// call the demo RPCs that the data workstream exposes in supabase/migrations.
