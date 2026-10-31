import { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import { alertTypeLabel, describeAlert } from '@/lib/format';
import type { AlertFeedItem } from '@/lib/types';
import { colors, MIN_TAP_TARGET, spacing } from '@/lib/theme';

type Props = {
  alert: AlertFeedItem;
  onPress?: (alert: AlertFeedItem) => void;
};

/** Map pin for an active alert. Shows age, confirmations, and verified state (R5). */
export function AlertPin({ alert, onPress }: Props) {
  return (
    <Marker
      coordinate={{ latitude: alert.lat, longitude: alert.lng }}
      title={alertTypeLabel(alert.type)}
      description={describeAlert(alert)}
      accessibilityLabel={`${alertTypeLabel(alert.type)}. ${describeAlert(alert)}`}
      accessibilityHint="Shows this alert's summary below the map"
      onPress={() => onPress?.(alert)}
    >
      <View style={styles.pin}>
        <Text style={styles.title}>{alertTypeLabel(alert.type)}</Text>
        <Text style={styles.meta}>{describeAlert(alert)}</Text>
        {!alert.verified && <Text style={styles.meta}>Student report · Unverified</Text>}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: { minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET, width: 150,
    backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 2,
    borderRadius: 8, padding: spacing.sm },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.text },
});
