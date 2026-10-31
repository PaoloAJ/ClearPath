import { alertConfidence, alertMeta, alertSeverity, alertTitle, formatExpiry, nearestBuilding } from '@/lib/format';
import type { AlertFeedItem } from '@/lib/types';

jest.mock('expo-secure-store', () => ({}));

const now = new Date('2026-10-30T12:00:00Z');
const alert: AlertFeedItem = {
  id: 'a1', type: 'elevator_out', geom: { type: 'Polygon', coordinates: [] }, lat: 29.6480, lng: -82.3438,
  created_by: 'user_1', verified: false, photo_path: null, created_at: '2026-10-30T11:48:00Z',
  expires_at: '2026-10-30T15:48:00Z', resolved_at: null, confirmations: 3, cleared_votes: 0,
};

it('titles and describes an alert like the Figma alert row', () => {
  expect(alertTitle(alert)).toBe('Elevator out: Marston Science Library');
  expect(alertMeta(alert, now)).toBe('12 min ago · 3 confirmations');
  expect(alertMeta({ ...alert, verified: true }, now)).toBe('12 min ago · Verified by UF Facilities');
});

it('picks the nearest demo-zone building', () => {
  expect(nearestBuilding({ lat: 29.6516, lng: -82.3429 }).name).toBe('Library West');
  expect(nearestBuilding({ lat: 29.6479, lng: -82.3450 }).name).toBe('CSE Building');
});

it('marks barriers that stop a step-free trip as high severity', () => {
  expect(alertSeverity('elevator_out')).toBe('high');
  expect(alertSeverity('blocked_path')).toBe('high');
  expect(alertSeverity('construction')).toBe('medium');
});

it('derives confidence from confirmations, with Facilities posts verified (R5)', () => {
  expect(alertConfidence({ verified: false, confirmations: 0 }).label).toBe('Low');
  expect(alertConfidence({ verified: false, confirmations: 1 }).label).toBe('Medium');
  expect(alertConfidence({ verified: false, confirmations: 3 }).label).toBe('High');
  expect(alertConfidence({ verified: false, confirmations: 4 }).label).toBe('Very high');
  expect(alertConfidence({ verified: true, confirmations: 0 })).toEqual({ label: 'Verified', level: 1 });
});

it('says when an alert expires (R5)', () => {
  expect(formatExpiry(alert.expires_at, now)).toBe('Expires in 3 h 48 min unless someone confirms it again.');
  expect(formatExpiry('2026-10-30T12:20:00Z', now)).toBe('Expires in 20 min unless someone confirms it again.');
  expect(formatExpiry('infinity', now)).toMatch(/until Facilities clears it/);
});
