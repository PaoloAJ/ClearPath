import { useMemo } from 'react';

import { CampusMap } from '@/components/CampusMap';
import { createAlertStore } from '@/lib/alerts';
import { useSupabase } from '@/lib/supabase';

// TODO(frontend): Realtime updates, elevator list, alert detail links, destination selection and route request.
export default function MapScreen() {
  const client = useSupabase();
  const store = useMemo(() => createAlertStore(client), [client]);
  return <CampusMap store={store} />;
}
