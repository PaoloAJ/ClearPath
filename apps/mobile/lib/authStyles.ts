import { StyleSheet } from 'react-native';

import { colors, spacing } from '@/lib/theme';

/** Shared by the sign-in and sign-up screens, which are the same form shape. */
export const authStyles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted },
  field: { gap: spacing.xs },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  link: { marginTop: spacing.sm, minHeight: 48, justifyContent: 'center' },
  linkText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
