import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, MIN_TAP_TARGET, spacing } from '@/lib/theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  hint?: string;
  variant?: 'primary' | 'secondary';
};

/** Primary action button. Always at least 48×48 pt and labelled for screen readers. */
export function BigButton({ label, hint, variant = 'primary', style, ...rest }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={(state) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={[styles.label, primary ? styles.labelPrimary : styles.labelSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP_TARGET,
    minWidth: MIN_TAP_TARGET,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { fontSize: 18, fontWeight: '600' },
  labelPrimary: { color: colors.onPrimary },
  labelSecondary: { color: colors.primary },
});
