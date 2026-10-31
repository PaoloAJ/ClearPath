import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/lib/theme';

/** Same announcement behavior as FormError, for non-error feedback (e.g. "code resent"). */
export function FormStatus({ message }: { message: string | null }) {
  useEffect(() => {
    if (message && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) return null;

  return (
    <Text accessibilityLiveRegion="assertive" style={styles.status}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  status: { fontFamily: fonts.semibold, fontSize: 16, color: colors.statusWorking },
});
