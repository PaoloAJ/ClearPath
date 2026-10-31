import { useAuth } from '@clerk/expo';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { FormError } from '@/components/FormError';
import { TravelProfile } from '@/components/TravelProfile';
import { createProfileStore } from '@/lib/profile';
import { useSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

// TODO(frontend): add temporary mode, end date, and haptics_only in M2.
export default function ProfileScreen() {
  const { userId, signOut } = useAuth();
  const client = useSupabase();
  const store = useMemo(() => userId ? createProfileStore(client, userId) : null, [client, userId]);
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
      {store && <TravelProfile key={userId} store={store} />}
      <View style={styles.footer}>
        <FormError message={error} />
        <BigButton
          label={signingOut ? 'Signing out…' : 'Sign out'}
          variant="secondary"
          onPress={onSignOut}
          disabled={signingOut}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  footer: { padding: spacing.lg, gap: spacing.md },
});
