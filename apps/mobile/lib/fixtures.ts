import * as SecureStore from 'expo-secure-store';

import { travelModes, type ProfileStore } from '@/lib/profile';
import type { AlertStore } from '@/lib/alerts';
import type { AlertFeedItem, Profile } from '@/lib/types';

export const sampleProfile: Profile = {
  user_id: 'demo-profile', mode: 'walking', temp_mode: null, temp_until: null,
  haptics_only: false, updated_at: '2026-10-30T12:00:00Z',
};
const key = 'clearpath.demo.profile';

// Deliberately separate from real profiles and auth tokens. No network calls.
export const fixtureProfileStore: ProfileStore = {
  async load() {
    const saved = await SecureStore.getItemAsync(key);
    if (!saved) return { ...sampleProfile };
    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null || !('mode' in parsed) ||
      !travelModes.some(({ mode }) => mode === parsed.mode)) {
      throw new Error('The sample profile could not be read. Reset the sample profile and try again.');
    }
    return { ...sampleProfile, mode: parsed.mode as Profile['mode'] };
  },
  async save(mode, _existing, extras = {}) {
    const profile: Profile = { ...sampleProfile, ...extras, mode, updated_at: new Date().toISOString() };
    await SecureStore.setItemAsync(key, JSON.stringify(profile));
    return profile;
  },
};

export async function resetSampleProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

// Relative dates keep the demo useful on any day. These are invented reports,
// not observations of real campus conditions or Facilities verification.
export function sampleAlerts(now = new Date()): AlertFeedItem[] {
  const points: { type: AlertFeedItem['type']; lat: number; lng: number; verified: boolean; confirmations: number }[] = [
    { type: 'construction', lat: 29.6514, lng: -82.3432, verified: true, confirmations: 3 },
    { type: 'blocked_path', lat: 29.6481, lng: -82.3435, verified: false, confirmations: 2 },
    { type: 'broken_ramp', lat: 29.6487, lng: -82.3442, verified: false, confirmations: 0 },
    { type: 'flooding', lat: 29.6479, lng: -82.3449, verified: false, confirmations: 1 },
  ];
  return points.map((point, index) => ({
    ...point, id: `00000000-0000-4000-8000-00000000000${index + 1}`, created_by: 'demo-reporter',
    geom: { type: 'Polygon', coordinates: [[
      [point.lng - 0.00004, point.lat - 0.00004], [point.lng + 0.00004, point.lat - 0.00004],
      [point.lng + 0.00004, point.lat + 0.00004], [point.lng - 0.00004, point.lat + 0.00004],
      [point.lng - 0.00004, point.lat - 0.00004],
    ]] },
    created_at: new Date(now.getTime() - (index + 1) * 10 * 60_000).toISOString(),
    expires_at: point.verified ? 'infinity' : new Date(now.getTime() + 4 * 3600_000).toISOString(),
    resolved_at: null, photo_path: null, cleared_votes: 0,
  }));
}

export const fixtureAlertStore: AlertStore = {
  async load() { return sampleAlerts(); },
};
