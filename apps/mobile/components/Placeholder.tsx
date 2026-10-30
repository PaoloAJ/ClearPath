import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/lib/theme';

/** Temporary screen body for scaffolded routes. Delete once a screen is built. */
export function Placeholder({ title, requirement }: { title: string; requirement: string }) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>Not built yet ({requirement}).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted },
});
