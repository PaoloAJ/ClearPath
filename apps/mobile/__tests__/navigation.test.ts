import { buildSteps, cardinal, distanceAlong, distanceMeters, nextInstruction, pointAlong, remainingEdgeIds } from '@/lib/navigation';
import type { LatLng, RouteOption } from '@/lib/types';

jest.mock('expo-secure-store', () => ({}));

// North about 130 m, then east about 90 m.
const path: LatLng[] = [{ lat: 29.6480, lng: -82.3440 }, { lat: 29.64917, lng: -82.3440 }, { lat: 29.64917, lng: -82.3431 }];

it('turns route geometry into one step per direction', () => {
  const steps = buildSteps(path);
  expect(steps).toHaveLength(2);
  expect(cardinal(steps[0]!.bearing)).toBe('north');
  expect(cardinal(steps[1]!.bearing)).toBe('east');
});

it('words the next instruction like the Figma header', () => {
  const steps = buildSteps(path);
  expect(nextInstruction(steps, 0, 'Turlington Hall')).toEqual({ title: 'Head north 130 m', then: 'then turn right', southward: false });
  const second = nextInstruction(steps, 140, 'Turlington Hall');
  expect(second.title).toMatch(/^Head east \d+ m$/);
  expect(second.then).toBe('then arrive at Turlington Hall');
  expect(nextInstruction(steps, 10_000, 'Turlington Hall').title).toBe('Arrived at Turlington Hall');
});

it('measures progress by projecting a position onto the path', () => {
  const total = distanceMeters(path[0]!, path[1]!) + distanceMeters(path[1]!, path[2]!);
  const halfway = pointAlong(path, total / 2);
  expect(Math.abs(distanceAlong(path, halfway) - total / 2)).toBeLessThan(1);
  // A point beside the path still projects onto it.
  expect(distanceAlong(path, { lat: 29.6485, lng: -82.34395 })).toBeGreaterThan(50);
});

it('keeps the edges still ahead for the route check (R2)', () => {
  const route = { edge_ids: [1, 2, 3, 4] } as RouteOption;
  expect(remainingEdgeIds(route, 0, 100)).toEqual([1, 2, 3, 4]);
  // The edge the user may still be on is kept.
  expect(remainingEdgeIds(route, 30, 100)).toEqual([1, 2, 3, 4]);
  expect(remainingEdgeIds(route, 50, 100)).toEqual([2, 3, 4]);
  expect(remainingEdgeIds(route, 100, 100)).toEqual([4]);
});
