import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Redirect, router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertBadge } from '@/components/AlertPin';
import { BigButton } from '@/components/BigButton';
import { Icon } from '@/components/Icon';
import { routeName } from '@/components/RouteCard';
import { RouteMap } from '@/components/RouteMap';
import { createDemoController, demoEnabled } from '@/lib/demo';
import { alertTypeLabel, formatAge, formatClock, formatDistance, nearestBuilding } from '@/lib/format';
import { buildSteps, distanceAlong, nextInstruction, pathLength, pointAlong, remainingEdgeIds, routeLatLngs } from '@/lib/navigation';
import { useRoutingApi } from '@/lib/routing';
import { useSupabase } from '@/lib/supabase';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { setTrip, setTripProgress, useTrip } from '@/lib/trip';
import type { AlertFeedItem, LatLng, RouteOption } from '@/lib/types';
import { useProfile } from '@/lib/useProfile';

type Pending = { alert: AlertFeedItem; reroute: RouteOption | null };

/** Figma "05 · Navigating", "06 · New alert en route", "07 · Rerouted", "13 · Kept route" (R2). */
export default function NavigateScreen() {
  const trip = useTrip();
  const client = useSupabase();
  const { checkRoute, getRoutes } = useRoutingApi();
  const { profile } = useProfile();
  const hapticsOnly = profile?.haptics_only ?? false;
  const [pos, setPos] = useState<LatLng | null>(trip?.from ?? null);
  const [gpsMoving, setGpsMoving] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [pending, setPending] = useState<Pending | null>(null);
  const [demoError, setDemoError] = useState('');

  const route = trip?.route ?? null;
  const path = useMemo(() => (route ? routeLatLngs(route) : []), [route]);
  const total = useMemo(() => pathLength(path), [path]);
  const steps = useMemo(() => buildSteps(path), [path]);
  const walked = pos && path.length > 1 ? distanceAlong(path, pos) : 0;

  // The Realtime callback reads the latest values through refs instead of resubscribing on every step.
  const latest = useRef({ trip, pos, walked, total, hapticsOnly });
  useEffect(() => {
    latest.current = { trip, pos, walked, total, hapticsOnly };
    setTripProgress(walked);
  });
  // A simulated walk never pauses; real moving comes from GPS speed.
  const moving = demoEnabled || gpsMoving;

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Follow the user: a simulated walk in demo mode, GPS otherwise. Restarts when a reroute swaps the route.
  useEffect(() => {
    if (!route || path.length < 2) return;
    if (demoEnabled) {
      return createDemoController(client).simulateWalk(path, trip?.mode === 'wheelchair' ? 'rolling' : 'walking', setPos);
    }
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 3 }, (location) => {
      setPos({ lat: location.coords.latitude, lng: location.coords.longitude });
      setGpsMoving((location.coords.speed ?? 0) > 0.5);
    }).then((sub) => { if (active) subscription = sub; else sub.remove(); }).catch(() => {});
    return () => { active = false; subscription?.remove(); };
    // A new route object (a reroute) restarts tracking; route ids repeat across responses, so they can't be the key.
    // `path` is derived from `route`, and `trip.mode` doesn't change mid-trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, client]);

  const consider = useCallback(async (alertId: string) => {
    const now = latest.current;
    if (!now.trip) return;
    const result = await checkRoute({ remaining_edge_ids: remainingEdgeIds(now.trip.route, now.walked, now.total), alert_id: alertId });
    if (!result.affected) return;
    const { data: alert } = await client.from('alerts_feed').select('*').eq('id', alertId).maybeSingle<AlertFeedItem>();
    if (!alert) return;
    const cue = `New barrier on your route: ${alertTypeLabel(alert.type)} near ${nearestBuilding(alert).name}.`;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (now.hapticsOnly) Speech.speak(`${cue} Stop to choose reroute or keep route.`);
    else AccessibilityInfo.announceForAccessibility(cue);
    let reroute: RouteOption | null = null;
    try {
      const from = now.pos ?? now.trip.from;
      const { routes } = await getRoutes({ from, to: { lat: now.trip.destination.latitude, lng: now.trip.destination.longitude }, profile: now.trip.mode });
      reroute = routes.find((option) => option.fits_profile) ?? null;
    } catch { /* The banner still offers Keep route. */ }
    setPending({ alert, reroute });
  }, [checkRoute, client, getRoutes]);

  // R2: every new alert is checked against the rest of the route.
  useEffect(() => {
    if (!route) return;
    // A fresh topic each time: removeChannel is async, and reusing a topic hands back the old, already
    // subscribed channel, which throws when .on() is called on it.
    const channel = client.channel(`trip-${route.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const id = (payload.new as { id?: string }).id;
        if (id) void consider(id).catch(() => {});
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [client, route, consider]);

  if (!trip || !route) return <Redirect href="/" />;

  const remaining = Math.max(0, total - walked);
  const share = total > 0 ? remaining / total : 0;
  const etaSeconds = route.duration_s * share;
  const etaMinutes = Math.max(1, Math.round(etaSeconds / 60));
  const arrive = formatClock(new Date(clock.getTime() + etaSeconds * 1000));
  const step = nextInstruction(steps, walked, trip.destination.name);
  // haptics_only users get the prompt once they stop moving (README → Alerts and trust).
  const showBanner = pending && (!hapticsOnly || !moving || demoEnabled);
  const extra = pending?.reroute ? Math.max(0, Math.round((pending.reroute.duration_s - etaSeconds) / 60)) : 0;

  function reroute() {
    if (!pending?.reroute || !trip) return;
    setTrip({ ...trip, from: pos ?? trip.from, route: pending.reroute,
      rerouted: `Rerouted around ${alertTypeLabel(pending.alert.type).toLowerCase()}` });
    setPending(null);
  }

  function end() {
    setTrip(null);
    router.navigate('/');
  }

  async function injectAhead() {
    setDemoError('');
    try {
      await createDemoController(client).injectAlertAhead([pointAlong(path, walked + 25), pointAlong(path, walked + 45)]);
    } catch {
      setDemoError('Could not add a demo alert. Is demo mode on for this project?');
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.next} accessible accessibilityRole="header"
        accessibilityLabel={`${step.title}, ${step.then}`}>
        <Icon name={step.southward ? 'nav-down' : 'nav-up'} size={34} />
        <View style={styles.instruction}>
          <Text style={styles.instructionTitle}>{step.title}</Text>
          <Text style={styles.instructionThen}>{step.then}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.mapArea}>
        <RouteMap routes={[route]} selectedId={route.id} you={pos} enRoute alerts={pending ? [pending.alert] : []}
          destination={{ lat: trip.destination.latitude, lng: trip.destination.longitude }} label={`Your route to ${trip.destination.name}`} />
        {showBanner && pending && <View style={styles.banner} accessibilityViewIsModal>
          <View style={styles.bannerAlert}>
            <AlertBadge type={pending.alert.type} ring={false} />
            <View style={styles.bannerText}>
              <Text style={styles.bannerEyebrow}>NEW ALERT ON YOUR ROUTE</Text>
              <Text style={styles.bannerTitle}>{alertTypeLabel(pending.alert.type)}</Text>
              <Text style={styles.bannerMeta}>
                Near {nearestBuilding(pending.alert).name} · {formatAge(pending.alert.created_at)}
                {pending.alert.verified ? ' · UF Facilities notice' : ''}
              </Text>
            </View>
          </View>
          {!pending.reroute && <Text style={styles.bannerMeta}>No other route fits your travel profile right now.</Text>}
          <View style={styles.bannerActions}>
            {pending.reroute && <BigButton compact label={extra > 0 ? `Reroute (+${extra} min)` : 'Reroute'} style={styles.flex} onPress={reroute} />}
            <BigButton compact variant="secondary" label="Keep route" style={styles.flex} onPress={() => setPending(null)} />
          </View>
        </View>}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.panel}>
        <ScrollView contentContainerStyle={styles.panelContent}>
          <View style={styles.eta} accessible accessibilityLabel={`${etaMinutes} minutes left. Arrive ${arrive}. ${formatDistance(remaining)} to go.`}>
            <Text style={styles.etaTime}>{etaMinutes} min</Text>
            <Text style={styles.etaMeta}>arrive {arrive} · {formatDistance(remaining)}</Text>
          </View>
          <View style={styles.tags}>
            <View style={styles.tag}><Text style={styles.tagText}>{routeName(route, trip.mode)}</Text></View>
            {trip.rerouted && <View style={[styles.tag, styles.reroutedTag]}><Text style={[styles.tagText, styles.reroutedText]}>{trip.rerouted}</Text></View>}
          </View>
          {route.notes.map((note) => (
            <View key={note} style={styles.fact}>
              <Icon name="fact-check" size={18} />
              <Text style={styles.factText}>{note}</Text>
            </View>
          ))}
          {demoEnabled && <BigButton compact variant="secondary" label="Demo: add an alert ahead" onPress={() => { void injectAhead(); }} />}
          {demoError ? <Text accessibilityRole="alert" style={styles.error}>{demoError}</Text> : null}
        </ScrollView>
        <BigButton variant="secondary" label="End route" onPress={end} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 20, backgroundColor: colors.text },
  instruction: { flex: 1, gap: spacing.xs },
  instructionTitle: { fontFamily: fonts.extrabold, fontSize: 23, color: colors.onPrimary },
  instructionThen: { fontFamily: fonts.regular, fontSize: 15, color: colors.onNavySoft },
  mapArea: { flex: 1 },
  banner: {
    position: 'absolute', top: 10, left: 12, right: 12, gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.background,
    shadowColor: colors.shadow, shadowOpacity: 0.32, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  bannerAlert: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bannerText: { flex: 1, gap: 3 },
  bannerEyebrow: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 0.6, color: colors.statusOut },
  bannerTitle: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 21, color: colors.text },
  bannerMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  bannerActions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  panel: {
    maxHeight: '45%', backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: 18, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 12,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  panelContent: { gap: 12 },
  eta: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  etaTime: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text },
  etaMeta: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  tagText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  reroutedTag: { backgroundColor: colors.orangeTint },
  reroutedText: { color: colors.statusOutText },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  factText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.text },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.statusOutText },
});
