import { Placeholder } from '@/components/Placeholder';

// TODO(frontend): active navigation. On each new alert from Realtime, call checkRoute with the
// remaining edge IDs; if affected, offer Reroute / Keep route. haptics_only users get
// expo-haptics + expo-speech instead, with the prompt shown once they stop moving.
export default function NavigateScreen() {
  return <Placeholder title="Navigation" requirement="R2" />;
}
