import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { colors } from '@/lib/theme';

/**
 * R6: a `Text` that just mounted isn't announced by VoiceOver, and
 * `accessibilityLiveRegion` only works on Android. Call `announceForAccessibility`
 * too so iOS speaks the error as well.
 */
export function FormError({ message }: { message: string | null }) {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) return null;

  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 16, fontWeight: '600', color: colors.statusOut },
});
