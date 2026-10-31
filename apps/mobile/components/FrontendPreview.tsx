import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { TravelProfile } from '@/components/TravelProfile';
import { CampusMap } from '@/components/CampusMap';
import { fixtureAlertStore, fixtureProfileStore, resetSampleProfile } from '@/lib/fixtures';
import { colors, spacing } from '@/lib/theme';

export function FrontendPreview() {
  const [panel, setPanel] = useState(false);
  const [open, setOpen] = useState<'profile' | 'map' | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  return <SafeAreaView style={styles.screen}>
    <ScrollView style={styles.controls} contentContainerStyle={styles.header}>
      <BigButton label="ClearPath" hint="Long press to open demo preview controls"
        onPress={() => setPanel(true)} onLongPress={() => setPanel(true)} />
      <Text style={styles.text}>Development demo preview · No sign-in or backend connection.</Text>
      {panel && <>
        <BigButton label="Preview travel profile" onPress={() => { setOpen('profile'); setPanel(false); }} />
        <BigButton label="Preview campus map" onPress={() => { setOpen('map'); setPanel(false); }} />
        <BigButton label={resetting ? 'Resetting…' : 'Reset sample profile'} variant="secondary" disabled={resetting}
          onPress={() => {
            setResetting(true);
            setError('');
            void resetSampleProfile().then(() => { setRevision((value) => value + 1); })
              .catch(() => setError('Could not reset the sample profile. Try again.'))
              .finally(() => setResetting(false));
          }} />
        <BigButton label="Close demo controls" variant="secondary" onPress={() => setPanel(false)} />
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
    </ScrollView>
    {open === 'map' ? <CampusMap store={fixtureAlertStore} simulated /> : open === 'profile' ? <TravelProfile key={revision} store={fixtureProfileStore} simulated /> :
      <View style={styles.header}><Text style={styles.text}>Long press ClearPath to open the demo controls. A regular tap also works for screen readers.</Text></View>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { flexGrow: 0, maxHeight: '50%' },
  header: { padding: spacing.md, gap: spacing.sm },
  text: { fontSize: 16, color: colors.text },
});
