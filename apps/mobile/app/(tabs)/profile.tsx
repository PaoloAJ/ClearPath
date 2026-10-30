import { useAuth } from '@clerk/expo';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { FormError } from '@/components/FormError';
import { colors, spacing } from '@/lib/theme';

// TODO(frontend): travel profile (mode, temporary mode + end date, haptics_only).
export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    if (signingOut) return;
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setError('Could not sign out. Check your connection and try again.');
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Travel profile
      </Text>
      <Text style={styles.body}>Not built yet (R3).</Text>
      <FormError message={error} />
      <BigButton
        label={signingOut ? 'Signing out…' : 'Sign out'}
        variant="secondary"
        onPress={onSignOut}
        disabled={signingOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textMuted },
});
