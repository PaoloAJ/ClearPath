import type { SupabaseClient } from '@supabase/supabase-js';

import type { Profile, TravelMode } from '@/lib/types';

export const travelModes: { mode: TravelMode; label: string }[] = [
  { mode: 'wheelchair', label: 'Wheelchair' },
  { mode: 'walking_aid', label: 'Walking aid' },
  { mode: 'bike', label: 'Bike' },
  { mode: 'scooter', label: 'Scooter' },
  { mode: 'skateboard', label: 'Skateboard' },
  { mode: 'walking', label: 'Walking' },
];

export interface ProfileStore {
  load(): Promise<Profile | null>;
  save(mode: TravelMode, existing: Profile | null): Promise<Profile>;
}

export function createProfileStore(client: SupabaseClient, userId: string): ProfileStore {
  return {
    async load() {
      const { data, error } = await client.from('profiles').select('*').eq('user_id', userId).maybeSingle<Profile>();
      if (error) throw new Error('Could not load your travel profile. Check your connection and try again.');
      return data;
    },
    async save(mode, existing) {
      const profile: Profile = {
        user_id: userId, mode, temp_mode: existing?.temp_mode ?? null,
        temp_until: existing?.temp_until ?? null, haptics_only: existing?.haptics_only ?? false,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client.from('profiles').upsert(profile, { onConflict: 'user_id' }).select().single<Profile>();
      if (error) throw new Error('Could not save your travel profile. Your selection is still here. Try again.');
      return data;
    },
  };
}
