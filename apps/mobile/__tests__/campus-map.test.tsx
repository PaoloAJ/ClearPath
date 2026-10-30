import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { CampusMap } from '@/components/CampusMap';
import { activeAlerts, campusRegion, demoBuildings } from '@/lib/alerts';
import { sampleAlerts } from '@/lib/fixtures';

jest.mock('expo-secure-store', () => ({}));
jest.mock('react-native-maps', () => {
  const { View, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: import('react-native').ViewProps) => <View {...props} />,
    Marker: (props: import('react-native').PressableProps) => <Pressable {...props} />,
  };
});

beforeEach(() => { jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false); });
afterEach(() => jest.restoreAllMocks());

it('shows four sample alerts and the demo-zone map without requesting location', async () => {
  await render(<CampusMap store={{ load: async () => sampleAlerts() }} simulated />);
  await screen.findByText('4 active alerts');
  const map = screen.getByLabelText('UF demo zone campus map');
  expect(map.props.initialRegion).toEqual(campusRegion);
  expect(map.props.showsUserLocation).toBe(false);
  for (const building of demoBuildings) expect(screen.getByLabelText(building.name)).toBeTruthy();
  expect(screen.getByText(/Invented sample alerts/)).toBeTruthy();
});

it('selects an alert pin and displays its trust summary', async () => {
  await render(<CampusMap store={{ load: async () => sampleAlerts() }} />);
  await screen.findByText('4 active alerts');
  await fireEvent.press(screen.getByLabelText(/Construction\. .*3 confirmations, verified/));
  await screen.findByText('Facilities verified');
});

it('offers the same alerts in separate verified and student list sections', async () => {
  await render(<CampusMap store={{ load: async () => sampleAlerts() }} />);
  await screen.findByText('4 active alerts');
  await fireEvent.press(screen.getByRole('button', { name: 'Show alert list' }));
  expect(screen.queryByLabelText('UF demo zone campus map')).toBeNull();
  expect(screen.getByRole('header', { name: 'Facilities verified' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Student reports · Unverified' })).toBeTruthy();
  for (const type of ['Construction', 'Blocked path', 'Broken ramp', 'Flooding']) expect(screen.getByText(type)).toBeTruthy();
  expect(screen.getByText(/no confirmations yet/)).toBeTruthy();
});

it('starts in list mode when a screen reader is enabled', async () => {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  await render(<CampusMap store={{ load: async () => sampleAlerts() }} />);
  await screen.findByRole('button', { name: 'Show map' });
  expect(screen.queryByLabelText('UF demo zone campus map')).toBeNull();
});

it('shows load errors and can refresh successfully', async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(sampleAlerts());
  await render(<CampusMap store={{ load }} />);
  await screen.findByRole('alert');
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh alerts' }));
  await screen.findByText('4 active alerts');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows an honest empty state instead of claiming paths are clear', async () => {
  await render(<CampusMap store={{ load: async () => [] }} />);
  await screen.findByText(/This does not guarantee a barrier-free path/);
});

it('filters resolved and expired alerts, including at the exact expiration time', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  const rows = sampleAlerts(now);
  const first = rows[0]!;
  expect(activeAlerts([
    first,
    { ...first, id: 'resolved', resolved_at: now.toISOString() },
    { ...first, id: 'expired', expires_at: now.toISOString() },
    { ...first, id: 'invalid-date', expires_at: 'invalid' },
  ], now).map((alert) => alert.id)).toEqual([first.id]);
});
