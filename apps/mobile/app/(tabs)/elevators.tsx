import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { ElevatorRow } from '@/components/ElevatorRow';
import { activeAlerts } from '@/lib/alerts';
import { nearestBuilding } from '@/lib/format';
import { useSupabase } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/lib/theme';
import type { AlertFeedItem, Elevator } from '@/lib/types';

/** Figma "11 · Elevator status": every elevator in the zone, status written out (R1, R5). */
export default function ElevatorsScreen() {
  const client = useSupabase();
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [outAlerts, setOutAlerts] = useState<AlertFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [rows, alerts] = await Promise.all([
        client.from('elevators').select('*').order('building').returns<Elevator[]>(),
        client.from('alerts_feed').select('*').eq('type', 'elevator_out').returns<AlertFeedItem[]>(),
      ]);
      if (rows.error) throw rows.error;
      setElevators(rows.data ?? []);
      // "See alert" links are extras; if the alerts query fails, the board still shows every status.
      setOutAlerts(alerts.error ? [] : activeAlerts(alerts.data ?? []));
      setNow(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Link an out-of-service elevator to the elevator-out alert nearest its building, when there is one.
  function alertFor(elevator: Elevator): AlertFeedItem | undefined {
    if (elevator.status !== 'out') return undefined;
    return outAlerts.find((alert) => nearestBuilding(alert).name.startsWith(elevator.building));
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} />}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>Elevator status</Text>
          <Text style={styles.intro}>
            <Text style={styles.verified}>Verified</Text> means UF Facilities posted it. Student reports expire after 4 hours unless confirmed.
          </Text>
        </View>
        {error ? <>
          <Text accessibilityRole="alert" style={styles.error}>Could not load elevator status.</Text>
          <BigButton label="Try again" variant="secondary" onPress={() => { void load(); }} />
        </> : <>
          {elevators.map((elevator) => {
            const alert = alertFor(elevator);
            return <ElevatorRow key={elevator.id} elevator={elevator} now={now}
              onSeeAlert={alert ? () => router.push({ pathname: '/alert/[id]', params: { id: alert.id } }) : undefined} />;
          })}
          {!loading && <Text style={styles.footnote}>
            {elevators.length === 0 ? 'No elevators are mapped in the demo zone yet.' : 'Only elevators on the mapped demo-zone paths are listed. More are added after the campus survey.'}
          </Text>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: spacing.md, gap: 12 },
  heading: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  verified: { fontFamily: fonts.bold, color: colors.primary },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, paddingHorizontal: spacing.xs },
  error: { fontFamily: fonts.semibold, fontSize: 15, color: colors.statusOutText },
});
