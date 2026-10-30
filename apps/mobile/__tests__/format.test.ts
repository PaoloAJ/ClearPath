import { describeAlert, formatAge } from '@/lib/format';
import { effectiveMode, type AlertFeedItem } from '@/lib/types';

const now = new Date('2026-10-29T12:00:00Z');

const alert: AlertFeedItem = {
  id: 'a1',
  type: 'construction',
  geom: { type: 'Polygon', coordinates: [] },
  lat: 29.6516,
  lng: -82.3429,
  created_by: 'user_1',
  verified: false,
  photo_path: null,
  created_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 4 * 3600_000).toISOString(),
  resolved_at: null,
  confirmations: 0,
  cleared_votes: 0,
};

describe('alert trust display (R5)', () => {
  it('shows a fresh report as just now with no confirmations', () => {
    expect(describeAlert(alert, now)).toBe('Just now, no confirmations yet');
  });

  it('includes the verified badge text', () => {
    const verified = { ...alert, verified: true, confirmations: 3, created_at: '2026-10-29T11:40:00Z' };
    expect(describeAlert(verified, now)).toBe('20 min ago, 3 confirmations, verified');
  });

  it('formats ages in hours past an hour', () => {
    expect(formatAge('2026-10-29T09:00:00Z', now)).toBe('3 hr ago');
  });
});

describe('effectiveMode (R3)', () => {
  it('uses temp_mode until temp_until passes', () => {
    const profile = { mode: 'walking' as const, temp_mode: 'walking_aid' as const, temp_until: '2026-12-10' };
    expect(effectiveMode(profile, now)).toBe('walking_aid');
    expect(effectiveMode(profile, new Date('2026-12-11T12:00:00'))).toBe('walking');
  });
});
