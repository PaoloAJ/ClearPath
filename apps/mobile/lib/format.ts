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
