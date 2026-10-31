import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertPin } from '@/components/AlertPin';
import { AlertRow } from '@/components/AlertRow';
import { BigButton } from '@/components/BigButton';
import { Icon } from '@/components/Icon';
import { activeAlerts, campusRegion, type AlertStore } from '@/lib/alerts';
import { travelModeLabel } from '@/lib/profile';
import { colors, fonts, MIN_TAP_TARGET, radius, spacing } from '@/lib/theme';
import { effectiveMode, type AlertFeedItem, type Profile } from '@/lib/types';

function profileSummary(profile: Profile): string {
  const mode = effectiveMode(profile);
  if (mode === profile.mode || !profile.temp_until) return `Routing for ${travelModeLabel(mode)}`;
  const until = new Date(`${profile.temp_until}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${travelModeLabel(mode)} until ${until}`;
}

type Props = {
  store: AlertStore;
  profile?: Profile | null;
  simulated?: boolean;
  /** Set by the report flow when it returns here; each new key shows the "Report sent" toast once. */
  reportedKey?: string | null;
};

/** Figma "02 · Map": search, profile chip, live map with pins, report button, and the Near you list. */
export function CampusMap({ store, profile = null, simulated = false, reportedKey = null }: Props) {
  const [alerts, setAlerts] = useState<AlertFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [hiddenKey, setHiddenKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    store.load().then((rows) => {
      if (active) { setAlerts(rows); setNow(new Date()); }
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [store, revision]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!reportedKey) return;
    const timer = setTimeout(() => setHiddenKey(reportedKey), 6000);
    return () => clearTimeout(timer);
  }, [reportedKey]);
  const toast = !!reportedKey && hiddenKey !== reportedKey;

  // TODO(frontend): Realtime subscription on alerts + elevators so new pins appear without a refresh.
  const visible = activeAlerts(alerts, now);
  // README → Alerts and trust: Facilities posts are listed apart from student reports.
  const verified = visible.filter((alert) => alert.verified);
  const reports = visible.filter((alert) => !alert.verified);
  const openAlert = (alert: AlertFeedItem) => router.push({ pathname: '/alert/[id]', params: { id: alert.id } });
  // Keep the alerts already on screen, so a failed refresh doesn't empty the map.
  function refresh() { setLoading(true); setError(false); setRevision((value) => value + 1); }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Where to?" accessibilityHint="Choose a destination and see routes"
          onPress={() => router.push('/routes')} style={styles.search}>
          <Icon name="search" size={20} />
          <Text style={styles.searchText}>Where to?</Text>
        </Pressable>
        <View style={styles.profileRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{profile ? profileSummary(profile) : 'No travel profile yet'}</Text>
          </View>
          <Pressable accessibilityRole="link" accessibilityLabel="Edit travel profile" onPress={() => router.navigate('/profile')}
            hitSlop={12} style={styles.edit}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.mapArea}>
        <MapView style={StyleSheet.absoluteFill} initialRegion={campusRegion} accessibilityLabel="UF demo zone campus map"
          showsUserLocation={!simulated} showsMyLocationButton={false} showsPointsOfInterests={false}>
          {visible.map((alert) => <AlertPin key={alert.id} alert={alert} onPress={openAlert} />)}
        </MapView>
        {toast && <View accessibilityLiveRegion="polite" style={styles.toast}>
          <Icon name="toast-check" size={22} />
          <Text style={styles.toastText}>
            <Text style={styles.toastStrong}>Report sent.</Text> It&apos;s on the map now. Students nearby can confirm it.
          </Text>
        </View>}
        <Pressable accessibilityRole="button" accessibilityLabel="Report a barrier" onPress={() => router.navigate('/report')}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
          <Icon name="plus" size={22} />
          <Text style={styles.fabText}>Report a barrier</Text>
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>Near you</Text>
          {!loading && !error && <Text accessibilityLiveRegion="polite" style={styles.count}>
            {visible.length === 1 ? '1 active alert' : `${visible.length} active alerts`}
          </Text>}
        </View>
        <ScrollView contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
          {simulated && <Text style={styles.note}>Demo preview · Invented sample alerts, not current campus conditions.</Text>}
          {error ? <>
            <Text accessibilityRole="alert" style={styles.error}>Could not load alerts.</Text>
            <BigButton label="Try again" variant="secondary" onPress={refresh} />
          </> : <>
            {verified.length > 0 && <Text accessibilityRole="header" style={styles.group}>UF Facilities · Verified</Text>}
            {verified.map((alert) => <AlertRow key={alert.id} alert={alert} now={now} onPress={() => openAlert(alert)} />)}
            {verified.length > 0 && reports.length > 0 && <Text accessibilityRole="header" style={styles.group}>Student reports</Text>}
            {reports.map((alert) => <AlertRow key={alert.id} alert={alert} now={now} onPress={() => openAlert(alert)} />)}
            {!loading && visible.length === 0 && <Text style={styles.note}>
              No active alerts reported in the demo zone. This does not guarantee a barrier-free path.
            </Text>}
          </>}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: spacing.sm, gap: spacing.sm },
  search: {
    minHeight: MIN_TAP_TARGET, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    borderRadius: radius.md, backgroundColor: colors.surface,
  },
  searchText: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  profileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chip: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  edit: { minHeight: 26, justifyContent: 'center' },
  editText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, textDecorationLine: 'underline' },
  mapArea: { flex: 1 },
  toast: {
    position: 'absolute', top: 12, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.text,
    shadowColor: colors.shadow, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  toastText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.onPrimary },
  toastStrong: { fontFamily: fonts.bold },
  fab: {
    position: 'absolute', right: spacing.md, bottom: spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, paddingLeft: spacing.md, paddingRight: 20, borderRadius: 26, backgroundColor: colors.report,
    shadowColor: colors.shadow, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  pressed: { opacity: 0.85 },
  fabText: { fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary },
  sheet: {
    maxHeight: 280, backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingTop: 14, paddingHorizontal: spacing.md, gap: spacing.sm,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  group: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  error: { fontFamily: fonts.semibold, fontSize: 15, color: colors.statusOutText },
});
