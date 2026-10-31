import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { createProfileStore } from '@/lib/profile';
import { useSupabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

/** The signed-in user's travel profile, reloaded whenever the screen regains focus. */
export function useProfile(): { profile: Profile | null; loaded: boolean } {
  const { userId } = useAuth();
  const client = useSupabase();
  const store = useMemo(() => (userId ? createProfileStore(client, userId) : null), [client, userId]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!store) return;
    let active = true;
    // A failed load leaves the last known profile in place; screens fall back to walking.
    store.load().then((row) => { if (active) setProfile(row); }).catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [store]));

  return { profile, loaded };
}
