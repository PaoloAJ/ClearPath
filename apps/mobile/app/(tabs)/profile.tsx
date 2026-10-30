import { useAuth } from '@clerk/expo';
import { useMemo } from 'react';

import { TravelProfile } from '@/components/TravelProfile';
import { createProfileStore } from '@/lib/profile';
import { useSupabase } from '@/lib/supabase';

// TODO(frontend): add temporary mode, end date, haptics_only and sign out in M2.
export default function ProfileScreen() {
  const { userId } = useAuth();
  const client = useSupabase();
  const store = useMemo(() => userId ? createProfileStore(client, userId) : null, [client, userId]);
  return store ? <TravelProfile key={userId} store={store} /> : null;
}
