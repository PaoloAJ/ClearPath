import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { CampusMap } from '@/components/CampusMap';
import { createAlertStore } from '@/lib/alerts';
import { useProfile } from '@/lib/useProfile';
import { useSupabase } from '@/lib/supabase';

// TODO(frontend): long-press the logo opens the demo panel (README → Demo mode).
export default function MapScreen() {
  const client = useSupabase();
  const store = useMemo(() => createAlertStore(client), [client]);
  const { profile } = useProfile();
  const { reported } = useLocalSearchParams<{ reported?: string }>();
  return <CampusMap store={store} profile={profile} reportedKey={reported ?? null} />;
}
