import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { Icon } from '@/components/Icon';
import { travelModeLabel, travelModes, type ProfileStore } from '@/lib/profile';
import { colors, fonts, MIN_TAP_TARGET, radius, spacing } from '@/lib/theme';
import { effectiveMode, type Profile, type TravelMode } from '@/lib/types';

const durations = [{ days: 7, label: '1 week' }, { days: 14, label: '2 weeks' }, { days: 42, label: '6 weeks' }];

function isoDateIn(days: number, now = new Date()): string {
  const d = new Date(now.getTime() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Figma "Checkbox chip": a 20 pt box with a check, inside a 48 pt row. */
function CheckRow({ label, checked, onPress, dashed = false, disabled = false }: {
  label: string; checked: boolean; onPress: () => void; dashed?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }}
      disabled={disabled} onPress={onPress} style={[styles.checkRow, dashed && styles.checkRowDashed, disabled && styles.dimmed]}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Icon name="checkbox-check" size={16} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function TravelProfile({ store, simulated = false, onSaved }: {
  store: ProfileStore; simulated?: boolean; onSaved?: (profile: Profile) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<TravelMode | null>(null);
  const [temporary, setTemporary] = useState(false);
  const [tempUntil, setTempUntil] = useState<string | null>(null);
  const [hapticsOnly, setHapticsOnly] = useState(false);
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
      const onTemp = saved ? effectiveMode(saved) !== saved.mode : false;
      // Keep a pick the user hasn't saved yet if the profile reloads.
      setMode((current) => current ?? (saved ? effectiveMode(saved) : null));
      setTemporary(onTemp);
      setTempUntil(onTemp ? saved?.temp_until ?? null : null);
      setHapticsOnly(saved?.haptics_only ?? false);
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

  // A temporary mode needs a usual one to switch back to.
  const usualMode = profile?.mode ?? null;
  const canSave = !!mode && loaded && !saving && (!temporary || (!!tempUntil && !!usualMode));

  function clearNotices() { setMessage(''); setError(''); }

  async function save() {
    if (!canSave || !mode || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    clearNotices();
    try {
      const saved = temporary && usualMode
        ? await store.save(usualMode, profile, { temp_mode: mode, temp_until: tempUntil, haptics_only: hapticsOnly })
        : await store.save(mode, profile, { temp_mode: null, temp_until: null, haptics_only: hapticsOnly });
      if (mounted.current) {
        setProfile(saved);
        setMessage(simulated ? 'Sample profile saved on this device. No account was updated.' : 'Travel profile saved.');
        onSaved?.(saved);
      }
    } catch {
      if (mounted.current) setError('Could not save your travel profile. Your selection is still here. Try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRAVEL PROFILE</Text>
          <Text accessibilityRole="header" style={styles.title}>How do you get around campus?</Text>
          <Text style={styles.intro}>We use this to choose routes you can actually take. Change it anytime.</Text>
          {simulated && <Text style={styles.notice}>Demo preview · Sample data. Saves stay on this device.</Text>}
        </View>

        {loading ? <Text accessibilityLiveRegion="polite" style={styles.intro}>Loading travel profile…</Text> : loaded ? <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Travel mode" style={styles.group}>
            {travelModes.map((option) => {
              const selected = mode === option.mode;
              return (
                <Pressable key={option.mode} accessibilityRole="radio" accessibilityLabel={option.label}
                  accessibilityHint={option.description} accessibilityState={{ checked: selected, disabled: saving }}
                  disabled={saving} onPress={() => { setMode(option.mode); clearNotices(); }}
                  style={[styles.option, selected && styles.optionSelected]}>
                  {selected ? <Icon name="radio-selected" size={22} /> : <View style={styles.radio} />}
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionSub}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <CheckRow label="This is temporary (like an injury)" dashed checked={temporary} disabled={!usualMode && !temporary}
            onPress={() => { setTemporary((value) => !value); setTempUntil(null); clearNotices(); }} />
          {!usualMode && !temporary && <Text style={styles.hint}>Save your usual mode first, then you can add a temporary one.</Text>}
          {temporary && usualMode && mode && <View style={styles.group}>
            <View accessibilityRole="radiogroup" accessibilityLabel="How long" style={styles.durations}>
              {durations.map((duration) => {
                const until = isoDateIn(duration.days);
                const selected = tempUntil === until;
                return (
                  <Pressable key={duration.days} accessibilityRole="radio" accessibilityLabel={duration.label}
                    accessibilityState={{ checked: selected }} onPress={() => { setTempUntil(until); clearNotices(); }}
                    style={[styles.duration, selected && styles.durationSelected]}>
                    <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>{duration.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {tempUntil && <Text style={styles.hint}>
              Routes use {travelModeLabel(mode)} until {formatDate(tempUntil)}, then switch back to {travelModeLabel(usualMode)}.
            </Text>}
          </View>}

          <View style={styles.group}>
            <Text style={styles.sectionTitle}>While I&apos;m moving</Text>
            <CheckRow label="Vibrate and speak new alerts instead of showing pop-ups" checked={hapticsOnly}
              onPress={() => { setHapticsOnly((value) => !value); clearNotices(); }} />
          </View>
          {/* TODO(frontend): the Figma "Avoid on my routes" list needs a profiles column and routing support first. */}

          {message ? <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text> : null}
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
          <BigButton label={saving ? 'Saving…' : 'Save and open map'} hint="Saves your travel profile"
            disabled={!canSave} accessibilityState={{ disabled: !canSave, busy: saving }} onPress={() => { void save(); }} />
        </> : <>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <BigButton label="Try loading again" onPress={() => {
            setLoading(true); setLoaded(false); setError(''); setAttempt((value) => value + 1);
          }} />
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: spacing.lg, gap: spacing.md },
  header: { gap: 6 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.52, color: colors.primary },
  title: { fontFamily: fonts.extrabold, fontSize: 27, lineHeight: 31, color: colors.text },
  intro: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  notice: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  group: { gap: spacing.sm },
  option: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: spacing.sm,
    borderWidth: 2, borderColor: colors.hairline, borderRadius: radius.md, backgroundColor: colors.background,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  // The ring is the radio's only state cue when unselected, so it uses the 3:1 border color.
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  optionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  checkRow: {
    minHeight: MIN_TAP_TARGET, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: spacing.sm,
    borderRadius: radius.sm, backgroundColor: colors.surface,
  },
  checkRowDashed: { backgroundColor: colors.background, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primarySoft },
  dimmed: { opacity: 0.6 },
  box: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  durations: { flexDirection: 'row', gap: spacing.sm },
  duration: {
    flex: 1, minHeight: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm,
    borderWidth: 2, borderColor: colors.hairline, backgroundColor: colors.background,
  },
  durationSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  durationLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  durationLabelSelected: { fontFamily: fonts.bold, color: colors.primary },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  status: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  error: { fontFamily: fonts.semibold, fontSize: 15, color: colors.statusOutText },
});
