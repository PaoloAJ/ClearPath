import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { AlertPin, useMarkerTracking } from '@/components/AlertPin';
import { Icon } from '@/components/Icon';
import { campusRegion } from '@/lib/alerts';
import { routeLatLngs } from '@/lib/navigation';
import { colors } from '@/lib/theme';
import type { AlertFeedItem, LatLng, RouteOption } from '@/lib/types';

export function routePath(route: RouteOption): { latitude: number; longitude: number }[] {
  return routeLatLngs(route).map(({ lat, lng }) => ({ latitude: lat, longitude: lng }));
}

type Props = {
  routes: RouteOption[];
  selectedId: string | null;
  you: LatLng | null;
  destination: LatLng | null;
  alerts?: AlertFeedItem[];
  /** While navigating, the dot gets the en-route style. */
  enRoute?: boolean;
  label: string;
};

/** Live map with the Figma route styling: the chosen route solid, alternatives dashed. */
export function RouteMap({ routes, selectedId, you, destination, alerts = [], enRoute = false, label }: Props) {
  // Draw the chosen route last so it sits on top of the alternatives.
  const tracking = useMarkerTracking();
  const ordered = [...routes].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
  return (
    <MapView style={StyleSheet.absoluteFill} initialRegion={campusRegion} accessibilityLabel={label}
      showsPointsOfInterests={false} showsMyLocationButton={false}>
      {ordered.map((route) => route.id === selectedId
        ? <Polyline key={route.id} coordinates={routePath(route)} strokeColor={colors.routeLine} strokeWidth={5} lineJoin="round" />
        : <Polyline key={route.id} coordinates={routePath(route)} strokeColor={colors.textMuted} strokeWidth={3} lineDashPattern={[6, 6]} />)}
      {alerts.map((alert) => <AlertPin key={alert.id} alert={alert} />)}
      {destination && <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracking} accessibilityLabel="Destination entrance">
        <Icon name="destination" size={20} />
      </Marker>}
      {you && <Marker coordinate={{ latitude: you.lat, longitude: you.lng }} anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracking} accessibilityLabel="You are here">
        <View style={styles.you}>
          <Icon name={enRoute ? 'you-enroute-halo' : 'you-halo'} size={32} />
          <View style={styles.dot}><Icon name={enRoute ? 'you-enroute' : 'you-dot'} size={20} /></View>
        </View>
      </Marker>}
    </MapView>
  );
}

const styles = StyleSheet.create({
  you: { width: 32, height: 32 },
  dot: { position: 'absolute', top: 6, left: 6 },
});
