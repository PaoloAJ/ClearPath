import { useAuth } from '@clerk/expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/BigButton';
import { Icon } from '@/components/Icon';
import { alertConfidence, alertSeverity, alertTypeLabel, formatAge, formatConfirmations, formatExpiry, nearestBuilding } from '@/lib/format';
import { useRoutingApi } from '@/lib/routing';
import { PHOTO_BUCKET, useSupabase } from '@/lib/supabase';
import { colors, fonts, MIN_TAP_TARGET, radius } from '@/lib/theme';
import { useTrip } from '@/lib/trip';
import type { AlertFeedItem, VoteKind } from '@/lib/types';

const THANKS: Record<VoteKind, string> = {
  still_there: 'Thanks. Your confirmation resets the 4-hour timer, so this stays on the map.',
  cleared: 'Thanks. Once a second person says it\'s cleared, it comes off the map.',
};

/** Figma "03 · Alert detail" and "12 · Alert, confirmed" (R5). */
export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const client = useSupabase();
  const { checkRoute } = useRoutingApi();
  const trip = useTrip();
  const [alert, setAlert] = useState<AlertFeedItem | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<VoteKind | null>(null);
  const [onRoute, setOnRoute] = useState(false);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const fetchAlert = useCallback(async () => {
    const { data, error: loadError } = await client.from('alerts_feed').select('*').eq('id', id).maybeSingle<AlertFeedItem>();
    if (loadError) throw loadError;
    return data;
  }, [client, id]);

  useEffect(() => {
    let active = true;
    fetchAlert().then(async (row) => {
      if (!active) return;
      setAlert(row);
      setNow(new Date());
      if (!row) { setError('This alert has expired or was cleared.'); return; }
      if (row.photo_path) {
        const { data } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(row.photo_path, 3600);
        if (active) setPhotoUrl(data?.signedUrl ?? null);
      }
      if (userId) {
        const { data } = await client.from('alert_votes').select('kind').eq('alert_id', row.id).eq('user_id', userId)
          .maybeSingle<{ kind: VoteKind }>();
        if (active) setMyVote(data?.kind ?? null);
      }
    }).catch(() => { if (active) setError('Could not load this alert. Check your connection and try again.'); });
    return () => { active = false; };
  }, [client, fetchAlert, userId]);

  useEffect(() => {
    if (!trip || !alert) return;
    let active = true;
    checkRoute({ remaining_edge_ids: trip.route.edge_ids, alert_id: alert.id })
      .then((result) => { if (active) setOnRoute(result.affected); }).catch(() => {});
    return () => { active = false; };
  }, [checkRoute, trip, alert]);

  useEffect(() => {
    if (Platform.OS === 'ios' && (error || myVote)) AccessibilityInfo.announceForAccessibility(error || THANKS[myVote!]);
  }, [error, myVote]);

  async function vote(kind: VoteKind) {
    if (!alert || voting) return;
    setVoting(true);
    setError('');
    const { error: voteError } = await client.rpc('vote_alert', { alert_id: alert.id, kind });
    setVoting(false);
    if (voteError) { setError('Could not send your answer. Try again.'); return; }
    setMyVote(kind);
    const row = await fetchAlert().catch(() => null);
    if (row) { setAlert(row); setNow(new Date()); }
  }

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const confidence = alert ? alertConfidence(alert) : null;
  const reporters = alert ? alert.confirmations + 1 : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to map" onPress={back} style={styles.back}>
          <Icon name="back" size={24} />
          <Text style={styles.backText}>Map</Text>
        </Pressable>

        {!alert ? <Text accessibilityRole={error ? 'alert' : undefined} style={error ? styles.error : styles.muted}>
          {error || 'Loading alert…'}
        </Text> : <>
          <View style={styles.titleRow}>
            <View style={[styles.severity, { backgroundColor: alertSeverity(alert.type) === 'high' ? colors.statusOut : colors.pinOrange }]}>
              <Text style={styles.bang}>!</Text>
            </View>
            <View style={styles.titleText}>
              <Text accessibilityRole="header" style={styles.title}>{alertTypeLabel(alert.type)}</Text>
              <Text style={styles.place}>Near {nearestBuilding(alert).name}</Text>
            </View>
          </View>

          <View style={styles.facts}>
            <View style={styles.fact}><Icon name="fact-clock" size={15} /><Text style={styles.factText}>{formatAge(alert.created_at, now)}</Text></View>
            {alert.verified
              ? <View style={styles.fact}><Icon name="fact-check" size={15} /><Text style={styles.factText}>Verified by UF Facilities</Text></View>
              : <View style={styles.fact}><Icon name="fact-people" size={15} /><Text style={styles.factText}>{formatConfirmations(alert.confirmations)}</Text></View>}
          </View>

          {confidence && <View style={styles.confidence} accessible
            accessibilityLabel={`Confidence: ${confidence.label}. ${alert.verified ? 'Posted by UF Facilities' : `From ${reporters} student ${reporters === 1 ? 'report' : 'reports'}`}`}>
            <View style={styles.confidenceLabels}>
              <Text style={styles.confidenceLabel}>Confidence: {confidence.label}</Text>
              <Text style={styles.muted}>{alert.verified ? 'Posted by UF Facilities' : `From ${reporters} student ${reporters === 1 ? 'report' : 'reports'}`}</Text>
            </View>
            <View style={styles.bar}><View style={[styles.level, { width: `${confidence.level * 100}%` }]} /></View>
          </View>}

          <View style={styles.photo}>
            {photoUrl
              ? <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover"
                  accessibilityLabel={`Photo of the ${alertTypeLabel(alert.type).toLowerCase()} from the reporter`} />
              : <><Icon name="photo-camera" size={30} /><Text style={styles.photoText}>No photo with this report</Text></>}
          </View>

          {onRoute && trip && <View style={styles.onRoute}>
            <Text style={styles.onRouteText}>
              <Text style={styles.strong}>On your route:</Text> this is on your current route to {trip.destination.name}.
            </Text>
          </View>}

          {myVote ? <View accessibilityLiveRegion="polite" style={styles.thanks}>
            <Text style={styles.thanksText}>{THANKS[myVote]}</Text>
          </View> : !alert.verified && <View style={styles.vote}>
            <BigButton label="Still there" style={styles.voteButton} disabled={voting} onPress={() => { void vote('still_there'); }} />
            <BigButton label="It's cleared" variant="secondary" style={styles.voteButton} disabled={voting}
              onPress={() => { void vote('cleared'); }} />
          </View>}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <View style={styles.expiry}>
            <Icon name="expiry-clock" size={16} />
            <Text style={styles.expiryText}>{formatExpiry(alert.expires_at, now)}</Text>
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, gap: 14 },
  back: { minHeight: MIN_TAP_TARGET, flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingRight: 10 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  severity: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bang: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.onPrimary },
  titleText: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.extrabold, fontSize: 23, lineHeight: 27, color: colors.text },
  place: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface },
  factText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  confidence: { gap: 6 },
  confidenceLabels: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  confidenceLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.hairline, overflow: 'hidden' },
  level: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
  photo: {
    height: 132, borderRadius: radius.md, backgroundColor: colors.mapGround, alignItems: 'center', justifyContent: 'center', gap: 6,
    overflow: 'hidden',
  },
  photoText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  onRoute: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  onRouteText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
  strong: { fontFamily: fonts.bold },
  vote: { flexDirection: 'row', gap: 10 },
  voteButton: { flex: 1 },
  thanks: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.text },
  thanksText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.onPrimary },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expiryText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  error: { fontFamily: fonts.semibold, fontSize: 15, color: colors.statusOutText },
});
