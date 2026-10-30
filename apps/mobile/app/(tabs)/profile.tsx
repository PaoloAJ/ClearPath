import { useAuth } from '@clerk/expo';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { colors, spacing } from '@/lib/theme';

// TODO(frontend): travel profile (mode, temporary mode + end date, haptics_only).
export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Travel profile
      </Text>
      <Text style={styles.body}>Not built yet (R3).</Text>
      <BigButton label="Sign out" variant="secondary" onPress={() => signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted },
});
