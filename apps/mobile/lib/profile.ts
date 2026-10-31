import type { SupabaseClient } from '@supabase/supabase-js';

import type { Profile, TravelMode } from '@/lib/types';

// Labels and descriptions follow the Figma travel-profile screen, mapped onto the profiles enum.
export const travelModes: { mode: TravelMode; label: string; description: string }[] = [
  { mode: 'wheelchair', label: 'Wheelchair', description: 'Manual or power. No stairs, gentle slopes' },
  { mode: 'walking_aid', label: 'Walking aid', description: 'Crutches, cane, or walker. Fewest stairs, least slope' },
  { mode: 'bike', label: 'Bike', description: 'Curb cuts and bike-friendly paths' },
  { mode: 'scooter', label: 'Scooter', description: 'Smooth pavement, no dismount zones' },
  { mode: 'skateboard', label: 'Skateboard', description: 'Smooth pavement, no dismount zones' },
  { mode: 'walking', label: 'Walking', description: 'Shortest route' },
];

export function travelModeLabel(mode: TravelMode): string {
  return travelModes.find((option) => option.mode === mode)?.label ?? mode;
}

export type ProfileExtras = Partial<Pick<Profile, 'temp_mode' | 'temp_until' | 'haptics_only'>>;

export interface ProfileStore {
  load(): Promise<Profile | null>;
  save(mode: TravelMode, existing: Profile | null, extras?: ProfileExtras): Promise<Profile>;
}

export function createProfileStore(client: SupabaseClient, userId: string): ProfileStore {
  return {
    async load() {
      const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle<Profile>();
      if (error) throw new Error('Could not load your travel profile. Check your connection and try again.');
      return data;
    },
    async save(mode, existing, extras = {}) {
      const profile: Profile = {
        user_id: userId, mode, temp_mode: existing?.temp_mode ?? null,
        temp_until: existing?.temp_until ?? null, haptics_only: existing?.haptics_only ?? false,
        ...extras, updated_at: new Date().toISOString(),
      };
      const { data, error } = await client.from('profiles').upsert(profile, { onConflict: 'user_id' }).select().single<Profile>();
      if (error) throw new Error('Could not save your travel profile. Your selection is still here. Try again.');
      return data;
    },
  };
}
