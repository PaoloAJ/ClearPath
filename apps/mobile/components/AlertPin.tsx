import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Icon, type IconName } from '@/components/Icon';
import { alertSeverity, alertTypeLabel, describeAlert } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { AlertFeedItem, AlertType } from '@/lib/types';

// Figma pins: elevator out and blocked paths use the close mark, construction the cone,
// broken ramps the bricks. Types without a pin icon in the design show "!".
const PIN_ICONS: Partial<Record<AlertType, IconName>> = {
  elevator_out: 'pin-elevator-out',
  blocked_path: 'pin-elevator-out',
  construction: 'pin-construction',
  broken_ramp: 'pin-bricks',
};

/** The 40 pt round pin, shared by the map and the new-alert banner. */
export function AlertBadge({ type, size = 40, ring = true }: { type: AlertType; size?: number; ring?: boolean }) {
  const icon = PIN_ICONS[type];
  return (
    <View style={[styles.badge, ring && styles.ring, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: alertSeverity(type) === 'high' ? colors.statusOut : colors.pinOrange,
    }]}>
      {icon ? <Icon name={icon} size={size / 2} /> : <Text style={[styles.bang, { fontSize: size * 0.4 }]}>!</Text>}
    </View>
  );
}

type Props = {
  alert: AlertFeedItem;
  onPress?: (alert: AlertFeedItem) => void;
};

/** Map pin for an active alert. Its label carries type, age, confirmations, and verified state (R5). */
export function AlertPin({ alert, onPress }: Props) {
  return (
    <Marker
      coordinate={{ latitude: alert.lat, longitude: alert.lng }}
      accessibilityLabel={`${alertTypeLabel(alert.type)}. ${describeAlert(alert)}`}
      onPress={() => onPress?.(alert)}
      tracksViewChanges={false}
    >
      <AlertBadge type={alert.type} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    borderWidth: 3, borderColor: colors.background,
    shadowColor: colors.shadow, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  bang: { fontFamily: fonts.extrabold, color: colors.onPrimary },
});
