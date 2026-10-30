import { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AlertPin } from '@/components/AlertPin';
import { BigButton } from '@/components/BigButton';
import { activeAlerts, campusRegion, demoBuildings, type AlertStore } from '@/lib/alerts';
import { alertTypeLabel, describeAlert } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import type { AlertFeedItem } from '@/lib/types';

export function CampusMap({ store, simulated = false }: { store: AlertStore; simulated?: boolean }) {
  const [alerts, setAlerts] = useState<AlertFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    store.load().then((rows) => {
      if (active) { setAlerts(rows); setNow(new Date()); }
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [store, revision]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (active && enabled) setList(true); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => { if (enabled) setList(true); });
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => { active = false; subscription.remove(); clearInterval(timer); };
  }, []);

  const visible = activeAlerts(alerts, now);
  const groups = [true, false].map((verified) => ({ verified, items: visible.filter((alert) => alert.verified === verified) }));
  const focused = visible.find((alert) => alert.id === selected);
  // Keep the alerts already on screen, so a failed refresh doesn't empty the map.
  function refresh() { setLoading(true); setError(false); setSelected(null); setRevision((value) => value + 1); }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Campus map</Text>
    {simulated && <Text style={styles.notice}>Demo preview · Invented sample alerts, not current campus conditions. Verification badges are simulated.</Text>}
    <Text style={styles.text}>Library West, Marston, Turlington, and CSE Building</Text>
    <BigButton label={list ? 'Show map' : 'Show alert list'} variant="secondary"
      hint={list ? 'Switches to the interactive campus map' : 'Shows the same alerts in a screen-reader-friendly list'}
      onPress={() => setList((value) => !value)} />
    <BigButton label={loading ? 'Loading alerts…' : 'Refresh alerts'} variant="secondary" disabled={loading}
      onPress={refresh} accessibilityState={{ disabled: loading, busy: loading }} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>Could not load alerts. Tap Refresh alerts to try again.</Text> :
      !loading && <Text accessibilityLiveRegion="polite" style={styles.text}>{visible.length} active alerts</Text>}
    {!list && <>
      <MapView style={styles.map} initialRegion={campusRegion} accessibilityLabel="UF demo zone campus map"
        showsUserLocation={false} showsMyLocationButton={false}>
        {demoBuildings.map((building) => <Marker key={building.name} coordinate={building}
          title={building.name} accessibilityLabel={building.name} />)}
        {visible.map((alert) => <AlertPin key={alert.id} alert={alert} onPress={() => setSelected(alert.id)} />)}
      </MapView>
      <Text style={styles.text}>Tap an alert for its summary. Use the alert list if pins overlap or the map is unavailable.</Text>
      {focused && <View style={styles.card} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={styles.heading}>{alertTypeLabel(focused.type)}</Text>
        <Text style={styles.text}>{describeAlert(focused, now)}</Text>
        <Text style={styles.text}>{focused.verified ? 'Facilities verified' : 'Student report · Unverified'}</Text>
      </View>}
    </>}
    {list && !loading && !error && <>
      {groups.map(({ verified, items }) => <View key={String(verified)} style={styles.group}>
        <Text accessibilityRole="header" style={styles.heading}>{verified ? 'Facilities verified' : 'Student reports · Unverified'}</Text>
        {items.length === 0 && <Text style={styles.text}>No active alerts in this section.</Text>}
        {items.map((alert) => <View key={alert.id} style={styles.card}>
          <Text style={styles.heading}>{alertTypeLabel(alert.type)}</Text>
          <Text style={styles.text}>{describeAlert(alert, now)}</Text>
          <Text style={styles.text}>Location: {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}</Text>
        </View>)}
      </View>)}
    </>}
    {!loading && !error && visible.length === 0 && <Text style={styles.text}>No active alerts reported in the demo zone. This does not guarantee a barrier-free path.</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  heading: { fontSize: 20, fontWeight: '600', color: colors.text },
  text: { fontSize: 16, color: colors.text },
  notice: { fontSize: 16, fontWeight: '600', color: colors.primary },
  error: { fontSize: 16, color: colors.statusOut },
  map: { height: 420, width: '100%' },
  group: { gap: spacing.sm },
  card: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
});
