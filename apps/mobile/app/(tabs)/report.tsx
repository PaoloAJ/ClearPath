import { useAuth } from '@clerk/expo';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { AlertIcon, Icon, type IconName } from '@/components/Icon';
import { demoEnabled, DEMO_REPORT_POINT } from '@/lib/demo';
import { nearestBuilding } from '@/lib/format';
import { PHOTO_BUCKET, useSupabase } from '@/lib/supabase';
import { colors, fonts, MIN_TAP_TARGET, radius, spacing } from '@/lib/theme';
import type { AlertType, LatLng } from '@/lib/types';

// The Figma tiles, mapped onto the alerts.type values the database accepts.
const tiles: { label: string; type: AlertType; icon: IconName | 'alert'; tint: string }[] = [
  { label: 'Elevator out', type: 'elevator_out', icon: 'tile-elevator-out', tint: colors.statusOutTint },
  { label: 'Path blocked', type: 'blocked_path', icon: 'tile-blocked', tint: colors.statusOutTint },
  { label: 'Construction', type: 'construction', icon: 'tile-construction', tint: colors.orangeTint },
  { label: 'Broken ramp', type: 'broken_ramp', icon: 'tile-rough', tint: colors.orangeTint },
  { label: 'Entrance closed', type: 'blocked_path', icon: 'tile-entrance', tint: colors.primaryTint },
  { label: 'Event or crowd', type: 'other', icon: 'tile-crowd', tint: colors.primaryTint },
  // Not in the Figma tile set; uses the library's alert icon.
  { label: 'Flooding', type: 'flooding', icon: 'alert', tint: colors.primaryTint },
];
type Tile = (typeof tiles)[number];

type Fix = LatLng & { accuracy: number | null; demo: boolean };

function reportError(message: string): string {
  if (message.includes('outside the demo zone')) {
    return 'That spot isn\'t near a mapped path in the demo zone (Library West, Marston, Turlington, CSE). Move closer and try again.';
  }
  return 'Could not send the report. Check your connection and try again.';
}

/** Figma "08 · Report, tap 1" and "09 · Report, tap 2" (R4: report a barrier in two taps). */
export default function ReportScreen() {
  const { userId } = useAuth();
  const client = useSupabase();
  const [tile, setTile] = useState<Tile | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS === 'ios' && error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  // Start finding the location on tap 1 so it's usually ready by tap 2.
  async function locate() {
    if (demoEnabled) { setFix({ ...DEMO_REPORT_POINT, accuracy: null, demo: true }); return; }
    setLocating(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) { setError('Location is off for ClearPath. Turn it on in Settings so the report lands in the right place.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setFix({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, demo: false });
    } catch {
      setError('Could not find your location. Try again outside or near a window.');
    } finally {
      setLocating(false);
    }
  }

  function choose(next: Tile) {
    setTile(next);
    setError('');
    if (!fix) void locate();
  }

  function reset() {
    setTile(null); setPhoto(null); setError('');
  }

  async function addPhoto() {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const pick = camera.granted ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await pick({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  }

  async function send() {
    if (!tile || !fix || sending) return;
    setSending(true);
    setError('');
    try {
      let photoPath: string | null = null;
      if (photo && userId) {
        // Storage policies only accept uploads into the reporter's own folder.
        photoPath = `${userId}/${randomUUID()}.jpg`;
        const body = await (await fetch(photo)).arrayBuffer();
        const { error: uploadError } = await client.storage.from(PHOTO_BUCKET).upload(photoPath, body, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
      }
      const { error: rpcError } = await client.rpc('report_alert', { type: tile.type, lat: fix.lat, lng: fix.lng, photo_path: photoPath });
      if (rpcError) throw rpcError;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      router.navigate({ pathname: '/', params: { reported: String(Date.now()) } });
    } catch (err) {
      setError(reportError(err instanceof Error ? err.message : String((err as { message?: string }).message ?? '')));
    } finally {
      setSending(false);
    }
  }

  if (!tile) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <Text style={styles.step}>TAP 1 OF 2</Text>
            <Text accessibilityRole="header" style={styles.title}>What&apos;s in the way?</Text>
          </View>
          <View style={styles.tiles}>
            {tiles.map((option) => (
              <Pressable key={option.label} accessibilityRole="button" accessibilityLabel={option.label}
                accessibilityHint="Chooses this barrier type. Next you confirm and send." onPress={() => choose(option)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                <View style={[styles.tileIcon, { backgroundColor: option.tint }]}>
                  {option.icon === 'alert' ? <AlertIcon size={28} /> : <Icon name={option.icon} size={28} />}
                </View>
                <Text style={styles.tileLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.note}>
            <Icon name="gps-note" size={20} />
            <Text style={styles.noteText}>Your location fills in from GPS. Adding a photo is optional.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const where = fix ? `Near ${nearestBuilding(fix).name}` : locating ? 'Finding your location…' : 'Location not found yet';
  const how = fix?.demo ? 'Demo location' : fix?.accuracy ? `From GPS · accurate to about ${Math.round(fix.accuracy)} m` : 'From GPS';
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, styles.grow]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change type" onPress={reset} style={styles.back}>
          <Icon name="back" size={24} />
          <Text style={styles.backText}>Change type</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.step}>TAP 2 OF 2</Text>
          <Text accessibilityRole="header" style={styles.title}>Send this report?</Text>
        </View>
        <View style={styles.reporting} accessible accessibilityLabel={`You're reporting: ${tile.label}`}>
          <Text style={styles.reportingLabel}>YOU&apos;RE REPORTING</Text>
          <Text style={styles.reportingType}>{tile.label}</Text>
        </View>
        <View style={styles.location} accessible accessibilityLabel={`${where}. ${fix ? how : ''}`} accessibilityLiveRegion="polite">
          <Icon name="gps" size={24} />
          <View style={styles.locationText}>
            <Text style={styles.locationPlace}>{where}</Text>
            {fix && <Text style={styles.locationHow}>{how}</Text>}
          </View>
        </View>
        {!fix && !locating && <BigButton label="Try finding my location again" variant="secondary" onPress={() => { setError(''); void locate(); }} />}
        <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Replace the photo' : 'Add a photo (optional)'}
          onPress={() => { void addPhoto(); }} style={styles.addPhoto}>
          {photo ? <Image source={{ uri: photo }} style={styles.thumb} accessible={false} /> : <Icon name="add-photo-camera" size={24} />}
          <Text style={styles.addPhotoText}>{photo ? 'Photo added · tap to replace' : 'Add a photo (optional)'}</Text>
        </Pressable>
        <Text style={styles.explain}>
          Others see it as <Text style={styles.strong}>&quot;Just now · no confirmations yet&quot;</Text>. It disappears in 4 hours
          unless someone taps &quot;Still there.&quot;
        </Text>
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <View style={styles.spacer} />
        <BigButton label={sending ? 'Sending…' : 'Send report'} variant="report" disabled={!fix || sending}
          accessibilityState={{ disabled: !fix || sending, busy: sending }} onPress={() => { void send(); }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: spacing.md, gap: 14 },
  grow: { flexGrow: 1, paddingTop: 14 },
  heading: { gap: spacing.xs, paddingLeft: spacing.xs },
  step: { fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 0.65, color: colors.pinOrange },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%', flexGrow: 1, minHeight: 124, alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 2, borderColor: colors.hairline, borderRadius: radius.lg, backgroundColor: colors.background, padding: spacing.sm,
  },
  tilePressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  tileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface },
  noteText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
  back: { minHeight: MIN_TAP_TARGET, flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingRight: 10 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  reporting: { gap: spacing.xs, padding: 18, borderRadius: radius.lg, backgroundColor: colors.text },
  reportingLabel: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.39, color: colors.onNavySoft },
  reportingType: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.onPrimary },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface },
  locationText: { flex: 1, gap: 2 },
  locationPlace: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  locationHow: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  addPhoto: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: radius.md,
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primarySoft, backgroundColor: colors.background,
  },
  thumb: { width: 32, height: 32, borderRadius: 6 },
  addPhotoText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  explain: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  strong: { fontFamily: fonts.bold, color: colors.text },
  error: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.statusOutText },
  spacer: { flexGrow: 1 },
});
