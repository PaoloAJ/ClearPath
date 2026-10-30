import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDistance, formatDuration } from '@/lib/format';
import { colors, MIN_TAP_TARGET, spacing } from '@/lib/theme';
import type { RouteOption } from '@/lib/types';

type Props = {
  route: RouteOption;
  onSelect: (route: RouteOption) => void;
};

/** One ranked route option. Routes that don't fit the profile still show, with the reason (R3). */
export function RouteCard({ route, onSelect }: Props) {
  const summary = `${route.label}. ${formatDistance(route.distance_m)}, ${formatDuration(route.duration_s)}.`;
  const fit = route.fits_profile ? 'Fits your profile.' : 'Does not fit your profile.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${summary} ${fit} ${route.notes.join('. ')}`}
      accessibilityHint="Starts navigation on this route"
      onPress={() => onSelect(route)}
      style={styles.card}
    >
      <Text style={styles.label}>{route.label}</Text>
      <Text style={styles.meta}>
        {formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}
      </Text>
      {!route.fits_profile && <Text style={styles.warning}>{fit}</Text>}
      <View>
        {route.notes.map((note) => (
          <Text key={note} style={styles.note}>
            {note}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TAP_TARGET,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  label: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 16, color: colors.textMuted },
  warning: { fontSize: 16, fontWeight: '600', color: colors.statusOut },
  note: { fontSize: 16, color: colors.text },
});
