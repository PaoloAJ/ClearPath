import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, fonts, MIN_TAP_TARGET, radius, spacing } from '@/lib/theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  hint?: string;
  /** Figma Button styles: Primary, Secondary, and Report (the large orange send button). */
  variant?: 'primary' | 'secondary' | 'report';
  /** 48 pt tall with a smaller label, for buttons inside banners. */
  compact?: boolean;
};

/** Primary action button. Always at least 48×48 pt and labelled for screen readers. */
export function BigButton({ label, hint, variant = 'primary', compact = false, style, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={(state) => [
        styles.base,
        styles[variant],
        compact && styles.compact,
        state.pressed && styles.pressed,
        rest.disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={[styles.label, variant === 'secondary' ? styles.labelSecondary : styles.labelFilled,
        variant === 'report' && styles.labelReport, compact && styles.labelCompact]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    minWidth: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.primarySoft },
  report: { backgroundColor: colors.report, minHeight: 64 },
  compact: { minHeight: MIN_TAP_TARGET, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  label: { fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' },
  labelFilled: { color: colors.onPrimary },
  labelSecondary: { color: colors.text },
  labelReport: { fontSize: 19 },
  labelCompact: { fontSize: 15 },
});
