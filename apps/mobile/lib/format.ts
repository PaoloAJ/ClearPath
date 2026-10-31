import { demoBuildings, type DemoBuilding } from './alerts';
import type { AlertFeedItem, AlertType } from './types';

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  construction: 'Construction',
  elevator_out: 'Elevator out',
  blocked_path: 'Blocked path',
  flooding: 'Flooding',
  broken_ramp: 'Broken ramp',
  other: 'Other barrier',
};

export function alertTypeLabel(type: AlertType): string {
  return ALERT_TYPE_LABELS[type];
}

export function formatAge(iso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

export function formatConfirmations(count: number): string {
  if (count === 0) return 'no confirmations yet';
  return count === 1 ? '1 confirmation' : `${count} confirmations`;
}

/** "Just now, no confirmations yet" / "20 min ago, 3 confirmations, verified" (R5). */
export function describeAlert(alert: AlertFeedItem, now = new Date()): string {
  const parts = [formatAge(alert.created_at, now), formatConfirmations(alert.confirmations)];
  if (alert.verified) parts.push('verified');
  return parts.join(', ');
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

/** "Elevator out: Marston Science Library", the Figma alert-row title. */
export function alertTitle(alert: Pick<AlertFeedItem, 'type' | 'lat' | 'lng'>): string {
  return `${alertTypeLabel(alert.type)}: ${nearestBuilding(alert).name}`;
}

/** "12 min ago · 3 confirmations", plus "UF Facilities" for verified posts (R5). */
export function alertMeta(alert: AlertFeedItem, now = new Date()): string {
  const parts = [formatAge(alert.created_at, now)];
  parts.push(alert.verified ? 'Verified by UF Facilities' : formatConfirmations(alert.confirmations));
  return parts.join(' · ');
}

/** Barriers that stop a step-free trip outright get the red marker; the rest get orange. */
export function alertSeverity(type: AlertType): 'high' | 'medium' {
  return type === 'elevator_out' || type === 'blocked_path' ? 'high' : 'medium';
}

/**
 * Confidence shown on alert detail. There's no separate score in the schema, so it comes
 * from confirmations: a Facilities post is verified; student reports rise with each "Still there."
 */
export function alertConfidence(alert: Pick<AlertFeedItem, 'verified' | 'confirmations'>): { label: string; level: number } {
  if (alert.verified) return { label: 'Verified', level: 1 };
  if (alert.confirmations >= 4) return { label: 'Very high', level: 0.94 };
  if (alert.confirmations >= 2) return { label: 'High', level: 0.78 };
  if (alert.confirmations === 1) return { label: 'Medium', level: 0.5 };
  return { label: 'Low', level: 0.22 };
}

/** "Expires in 3 h 48 min unless someone confirms it again." (R5: stale alerts expire.) */
export function formatExpiry(expiresAt: string, now = new Date()): string {
  if (expiresAt === 'infinity') return 'Posted by UF Facilities. It stays up until Facilities clears it.';
  const minutes = Math.max(0, Math.round((Date.parse(expiresAt) - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const left = hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
  return `Expires in ${left} unless someone confirms it again.`;
}

/** Nearest demo-zone building, used for "Near Marston Science Library" labels. */
export function nearestBuilding(point: { lat: number; lng: number }): DemoBuilding {
  let best = demoBuildings[0]!;
  let bestDistance = Infinity;
  for (const building of demoBuildings) {
    const distance = (building.latitude - point.lat) ** 2 + (building.longitude - point.lng) ** 2;
    if (distance < bestDistance) { best = building; bestDistance = distance; }
  }
  return best;
}

/** "10:52 AM", the arrival time on the trip panel. */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
