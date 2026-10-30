import { Marker } from 'react-native-maps';

import { alertTypeLabel, describeAlert } from '@/lib/format';
import type { AlertFeedItem } from '@/lib/types';

type Props = {
  alert: AlertFeedItem;
  onPress?: (alert: AlertFeedItem) => void;
};

/** Map pin for an active alert. Shows age, confirmations, and verified state (R5). */
export function AlertPin({ alert, onPress }: Props) {
  // TODO(frontend): custom pin view with type icon + verified badge, sized for 48pt targets.
  return (
    <Marker
      coordinate={{ latitude: alert.lat, longitude: alert.lng }}
      title={alertTypeLabel(alert.type)}
      description={describeAlert(alert)}
      accessibilityLabel={`${alertTypeLabel(alert.type)}. ${describeAlert(alert)}`}
      onPress={() => onPress?.(alert)}
    />
  );
}
