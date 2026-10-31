import type { SupabaseClient } from '@supabase/supabase-js';

import type { AlertFeedItem } from '@/lib/types';

export interface AlertStore {
  load(): Promise<AlertFeedItem[]>;
}

export const campusRegion = {
  latitude: 29.6493, longitude: -82.3443, latitudeDelta: 0.009, longitudeDelta: 0.009,
};

export interface DemoBuilding { name: string; latitude: number; longitude: number }

// The v1 demo zone. These are also the route destinations.
export const demoBuildings: DemoBuilding[] = [
  { name: 'Library West', latitude: 29.6516, longitude: -82.3429 },
  { name: 'Marston Science Library', latitude: 29.6481, longitude: -82.3437 },
  { name: 'Turlington Hall', latitude: 29.6487, longitude: -82.3442 },
  { name: 'CSE Building', latitude: 29.6479, longitude: -82.3449 },
];

export function activeAlerts(alerts: AlertFeedItem[], now = new Date()): AlertFeedItem[] {
  return alerts.filter((alert) => !alert.resolved_at &&
    (alert.expires_at === 'infinity' || Date.parse(alert.expires_at) > now.getTime()));
}

export function createAlertStore(client: SupabaseClient): AlertStore {
  return {
    async load() {
      const { data, error } = await client.from('alerts_feed').select('*').order('created_at', { ascending: false }).returns<AlertFeedItem[]>();
      if (error) throw new Error('Could not load campus alerts.');
      return data ?? [];
    },
  };
}
