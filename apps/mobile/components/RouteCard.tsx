import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDistance, formatDuration } from '@/lib/format';
import { colors, fonts, MIN_TAP_TARGET, radius } from '@/lib/theme';
import type { RouteOption, TravelMode } from '@/lib/types';

const FOR_YOU_NAMES: Record<TravelMode, string> = {
  wheelchair: 'Step-free',
  walking_aid: 'Easiest',
  bike: 'Ride-friendly',
  scooter: 'Ride-friendly',
  skateboard: 'Ride-friendly',
  walking: 'Best',
};

/** "Step-free" for the route the planner picked for a wheelchair profile; otherwise the API label. */
export function routeName(route: RouteOption, mode: TravelMode): string {
  return route.label === 'For you' ? FOR_YOU_NAMES[mode] : route.label;
}

type Props = {
  route: RouteOption;
  mode: TravelMode;
  selected: boolean;
  onSelect: (route: RouteOption) => void;
};

/** Figma "Route card". Routes that don't fit the profile still show, with the reason (R3). */
export function RouteCard({ route, mode, selected, onSelect }: Props) {
  const name = routeName(route, mode);
  const forYou = route.label === 'For you';
  const detail = route.fits_profile
    ? route.notes[0] ?? 'Fits your travel profile.'
    : `Breaks your profile: ${route.notes.length ? route.notes.join('. ') : 'it uses paths your profile avoids'}.`;
  const summary = `${name}${forYou ? ', for you' : ''}. ${formatDuration(route.duration_s)}, ${formatDistance(route.distance_m)}. ${detail}`;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={summary}
      accessibilityState={{ checked: selected }}
      onPress={() => onSelect(route)}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={styles.text}>
        <View style={styles.head}>
          <Text style={styles.name}>{name}</Text>
          {forYou && <View style={styles.badge}><Text style={styles.badgeText}>FOR YOU</Text></View>}
        </View>
        <Text style={route.fits_profile ? styles.detail : styles.warning}>{detail}</Text>
      </View>
      <Text style={styles.time}>{formatDuration(route.duration_s)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: Math.max(MIN_TAP_TARGET, 70), flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: radius.md, borderWidth: 2, borderColor: colors.hairline, backgroundColor: colors.background,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  text: { flex: 1, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primary },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.33, color: colors.onPrimary },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.textMuted },
  warning: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: colors.statusOutText },
  time: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
});
