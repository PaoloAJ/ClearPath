import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { formatAge } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';
import type { Elevator, ElevatorStatus } from '@/lib/types';

// Status is always written out with its own icon (R6: never color alone).
const STATUS: Record<ElevatorStatus, { label: string; icon: IconName; text: string; fill: string }> = {
  out: { label: 'Out of service', icon: 'chip-out', text: colors.statusOutText, fill: colors.statusOutTint },
  working: { label: 'Working', icon: 'chip-working', text: colors.statusWorking, fill: colors.statusWorkingTint },
  unconfirmed: { label: 'Unconfirmed', icon: 'chip-unconfirmed', text: colors.statusUnconfirmed, fill: colors.hairline },
};

export function elevatorMeta(elevator: Elevator, now = new Date()): string {
  if (!elevator.last_reported_at) return 'No recent reports';
  const age = formatAge(elevator.last_reported_at, now);
  return elevator.verified ? `Verified · UF Facilities · ${age}` : `Student report · ${age}`;
}

/** Figma "Elevator row": building, elevator, written status chip, and who reported it when (R1, R5). */
export function ElevatorRow({ elevator, now, onSeeAlert }: { elevator: Elevator; now: Date; onSeeAlert?: () => void }) {
  const status = STATUS[elevator.status];
  const meta = elevatorMeta(elevator, now);
  return (
    <View style={styles.row} accessible={!onSeeAlert}
      accessibilityLabel={`${elevator.building}, ${elevator.name}. ${status.label}. ${meta}`}>
      <View style={styles.top}>
        <View style={styles.names}>
          <Text style={styles.building}>{elevator.building}</Text>
          <Text style={styles.name}>{elevator.name}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: status.fill }]}>
          <Icon name={status.icon} size={13} />
          <Text style={[styles.chipText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.meta}>{meta}</Text>
        {onSeeAlert && <Pressable accessibilityRole="link" accessibilityLabel={`See the alert for ${elevator.building}, ${elevator.name}`}
          onPress={onSeeAlert} hitSlop={14}>
          <Text style={styles.link}>See alert</Text>
        </Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 80, gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  names: { flex: 1, gap: 1 },
  building: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  name: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.extrabold, fontSize: 13 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  link: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary, textDecorationLine: 'underline' },
});
