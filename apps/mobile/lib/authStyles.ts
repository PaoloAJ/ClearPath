import { StyleSheet } from 'react-native';

import { colors, fonts, radius, spacing } from '@/lib/theme';

/** Shared by the sign-in and sign-up screens, which are the same form shape. */
export const authStyles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { fontFamily: fonts.extrabold, fontSize: 27, lineHeight: 31, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  field: { gap: spacing.xs },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  link: { marginTop: spacing.sm, minHeight: 48, justifyContent: 'center' },
  linkText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
});
