import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { FormError } from '@/components/FormError';
import { TravelProfile } from '@/components/TravelProfile';
import { createProfileStore } from '@/lib/profile';
import { useSupabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

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
      {store && <TravelProfile key={userId} store={store} onSaved={() => router.navigate('/')} />}
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
  footer: { paddingHorizontal: 20, paddingBottom: spacing.md, gap: spacing.md },
});
