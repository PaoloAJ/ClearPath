import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { alertMeta, alertSeverity, alertTitle } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { AlertFeedItem } from '@/lib/types';

/** Figma "Alert row": severity dot, "Type: Building", age and trust, chevron to the detail screen. */
export function AlertRow({ alert, now, onPress }: { alert: AlertFeedItem; now: Date; onPress: () => void }) {
  const title = alertTitle(alert);
  const meta = alertMeta(alert, now);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} accessibilityHint="Opens the alert details"
      onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.severity, { backgroundColor: alertSeverity(alert.type) === 'high' ? colors.statusOut : colors.pinOrange }]}>
        <Text style={styles.bang}>!</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Icon name="chevron-right" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderRadius: radius.md, backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  severity: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bang: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.onPrimary },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
});
