import { useLocalSearchParams } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';

// TODO(frontend): type, photo, confidence, affected routes, expiry,
// and Still there / It's cleared buttons (vote_alert RPC).
export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Placeholder title={`Alert ${id}`} requirement="R5" />;
}
