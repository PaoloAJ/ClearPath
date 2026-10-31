import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { Icon } from '@/components/Icon';
import { RouteCard, routeName } from '@/components/RouteCard';
import { RouteMap } from '@/components/RouteMap';
import { demoBuildings, type DemoBuilding } from '@/lib/alerts';
import { demoEnabled, DEMO_START } from '@/lib/demo';
import { travelModeLabel } from '@/lib/profile';
import { RoutingError, useRoutingApi } from '@/lib/routing';
import { colors, fonts, MIN_TAP_TARGET, radius, spacing } from '@/lib/theme';
import { setTrip } from '@/lib/trip';
import { effectiveMode, type LatLng, type RouteOption } from '@/lib/types';
import { useProfile } from '@/lib/useProfile';

function routingMessage(err: unknown): string {
  if (err instanceof RoutingError && err.status === 422) {
    return 'No route from here. You may be outside the demo zone (Library West, Marston, Turlington, CSE), or no path connects these places.';
  }
  return 'Could not load routes. Check your connection and try again.';
}

/** Figma "04 · Route options", with a demo-zone destination list first (R3). */
export default function RoutesScreen() {
  const { to } = useLocalSearchParams<{ to?: string }>();
  const destination = demoBuildings.find((building) => building.name === to) ?? null;
  const { profile, loaded } = useProfile();
  const mode = profile ? effectiveMode(profile) : 'walking';
  const { getRoutes } = useRoutingApi();
  const [from, setFrom] = useState<LatLng | null>(demoEnabled ? DEMO_START : null);
  const [locationError, setLocationError] = useState('');
  const [result, setResult] = useState<{ key: string; routes: RouteOption[]; error: string } | null>(null);
  const [picked, setPicked] = useState<{ key: string; id: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (demoEnabled || from) return;
    let active = true;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) throw new Error('location');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (active) setFrom({ lat: position.coords.latitude, lng: position.coords.longitude });
    })().catch(() => { if (active) setLocationError('Turn on location for ClearPath so routes can start where you are.'); });
    return () => { active = false; };
  }, [from, attempt]);

  // One key per request; loading and results are derived from it rather than set inside the effect.
  const requestKey = destination && from && loaded ? `${destination.name}|${from.lat},${from.lng}|${mode}|${attempt}` : null;
  useEffect(() => {
    if (!requestKey || !destination || !from) return;
    let active = true;
    getRoutes({ from, to: { lat: destination.latitude, lng: destination.longitude }, profile: mode })
      .then(({ routes: found }) => { if (active) setResult({ key: requestKey, routes: found, error: '' }); })
      .catch((err: unknown) => { if (active) setResult({ key: requestKey, routes: [], error: routingMessage(err) }); });
    return () => { active = false; };
  }, [requestKey, destination, from, mode, getRoutes]);

  const current = result?.key === requestKey ? result : null;
  const loading = !!requestKey && !current;
  const routes = current?.routes ?? [];
  const error = locationError || current?.error || '';
  const selectedId = picked && picked.key === requestKey ? picked.id
    : (routes.find((route) => route.fits_profile) ?? routes[0])?.id ?? null;
  const selected = routes.find((route) => route.id === selectedId) ?? null;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  function start() {
    if (!selected || !destination || !from) return;
    setTrip({ from, destination, mode, route: selected, rerouted: null });
    router.push('/navigate');
  }

  function pick(building: DemoBuilding) {
    router.setParams({ to: building.name });
  }

  function retry() {
    setLocationError('');
    setAttempt((n) => n + 1);
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
          <Icon name="back" size={24} />
        </Pressable>
        <View style={styles.trip}>
          <Text accessibilityRole="header" style={styles.to}>{destination ? `To: ${destination.name}` : 'Where to?'}</Text>
          <Text style={styles.from}>{demoEnabled ? 'From Library West (demo start)' : 'From your location'}</Text>
          <Text style={styles.for}>For {travelModeLabel(mode).toLowerCase()}</Text>
        </View>
      </SafeAreaView>

      {!destination ? (
        <ScrollView contentContainerStyle={styles.pickList}>
          <Text style={styles.muted}>Choose a building in the demo zone.</Text>
          {demoBuildings.map((building) => (
            <Pressable key={building.name} accessibilityRole="button" accessibilityLabel={building.name}
              onPress={() => pick(building)} style={({ pressed }) => [styles.place, pressed && styles.placePressed]}>
              <Text style={styles.placeName}>{building.name}</Text>
              <Icon name="chevron-right" size={18} />
            </Pressable>
          ))}
        </ScrollView>
      ) : <>
        <View style={styles.mapArea}>
          <RouteMap routes={routes} selectedId={selectedId} you={from}
            destination={{ lat: destination.latitude, lng: destination.longitude }} label={`Route options to ${destination.name}`} />
        </View>
        <View style={styles.panel}>
          {loading && <Text accessibilityLiveRegion="polite" style={styles.muted}>Finding routes…</Text>}
          {error ? <>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <BigButton label="Try again" variant="secondary" onPress={retry} />
          </> : null}
          <ScrollView accessibilityRole="radiogroup" accessibilityLabel="Route options" contentContainerStyle={styles.cards}>
            {routes.map((route) => <RouteCard key={route.id} route={route} mode={mode} selected={route.id === selectedId}
              onSelect={(next) => { if (requestKey) setPicked({ key: requestKey, id: next.id }); }} />)}
          </ScrollView>
          {selected && <BigButton label={`Start ${routeName(selected, mode).toLowerCase()} route`} onPress={start} />}
        </View>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', gap: 6, backgroundColor: colors.background, paddingLeft: spacing.sm, paddingRight: spacing.md, paddingTop: 14, paddingBottom: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  trip: { flex: 1, gap: 3, paddingTop: 6 },
  to: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  from: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  for: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  pickList: { padding: spacing.md, gap: spacing.sm },
  place: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14,
    borderRadius: radius.md, borderWidth: 2, borderColor: colors.hairline, backgroundColor: colors.background,
  },
  placePressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  placeName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  mapArea: { flex: 1, minHeight: 200 },
  panel: {
    maxHeight: '60%', backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingTop: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  cards: { gap: spacing.sm },
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, minHeight: MIN_TAP_TARGET / 2 },
  error: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.statusOutText },
});
