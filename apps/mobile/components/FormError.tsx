import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/lib/theme';

/**
 * R6: a `Text` that just mounted isn't announced by VoiceOver, and
 * `accessibilityLiveRegion` only works on Android. Call `announceForAccessibility`
 * on iOS so it speaks the error too; on Android the live region already
 * announces it, so calling both would read it out twice.
 */
export function FormError({ message }: { message: string | null }) {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) return null;

  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.semibold, fontSize: 16, color: colors.statusOutText },
});
