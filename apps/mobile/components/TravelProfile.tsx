import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { travelModes, type ProfileStore } from '@/lib/profile';
import { colors, spacing } from '@/lib/theme';
import type { Profile, TravelMode } from '@/lib/types';

export function TravelProfile({ store, simulated = false }: { store: ProfileStore; simulated?: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<TravelMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    store.load().then((saved) => {
      if (!active) return;
      setProfile(saved);
      // Keep a pick the user hasn't saved yet if the profile reloads.
      setMode((current) => current ?? saved?.mode ?? null);
      setLoaded(true);
    }).catch(() => {
      if (active) setError('Could not load your travel profile. Try again.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [store, attempt]);

  useEffect(() => {
    // Android already reads the live region below, so only iOS needs the announcement.
    if (Platform.OS === 'ios' && (message || error)) AccessibilityInfo.announceForAccessibility(error || message);
  }, [message, error]);

  async function save() {
    if (!mode || !loaded || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await store.save(mode, profile);
      if (mounted.current) {
        setProfile(saved);
        setMessage(simulated ? 'Sample profile saved on this device. No account was updated.' : 'Travel profile saved.');
      }
    } catch {
      if (mounted.current) setError('Could not save your travel profile. Your selection is still here. Try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Travel profile</Text>
      {simulated && <Text style={styles.notice}>Demo preview · Sample data. Saves stay on this device.</Text>}
      <Text style={styles.text}>How do you usually get around? Choose one travel mode.</Text>
      {loading ? <Text accessibilityLiveRegion="polite" style={styles.text}>Loading travel profile…</Text> : loaded ? <>
        <View accessibilityRole="radiogroup" accessibilityLabel="Travel mode" style={styles.options}>
          {travelModes.map((option) => <BigButton key={option.mode}
            label={`${option.label}${mode === option.mode ? ' · Selected' : ''}`}
            accessibilityLabel={option.label} accessibilityRole="radio"
            accessibilityState={{ checked: mode === option.mode, disabled: saving }}
            variant={mode === option.mode ? 'primary' : 'secondary'} disabled={saving}
            onPress={() => { setMode(option.mode); setMessage(''); setError(''); }} />)}
        </View>
        {profile && <Text style={styles.text}>Saved travel mode: {travelModes.find((item) => item.mode === profile.mode)?.label}</Text>}
        <BigButton label={saving ? 'Saving…' : 'Save travel profile'} hint="Saves your selected travel mode"
          disabled={!mode || saving} accessibilityState={{ disabled: !mode || saving, busy: saving }} onPress={() => { void save(); }} />
        <Text style={styles.text}>Temporary travel modes and navigation preferences are coming next.</Text>
      </> : <BigButton label="Try loading again" onPress={() => {
        setLoading(true); setLoaded(false); setError(''); setAttempt((value) => value + 1);
      }} />}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  options: { gap: spacing.sm },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  text: { fontSize: 18, color: colors.text },
  notice: { fontSize: 18, fontWeight: '600', color: colors.primary },
  error: { fontSize: 18, color: colors.statusOut },
});
