import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { CampusMap } from '@/components/CampusMap';
import { activeAlerts, campusRegion } from '@/lib/alerts';
import { sampleAlerts, sampleProfile } from '@/lib/fixtures';

jest.mock('expo-secure-store', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-maps', () => {
  const { View, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: (props: import('react-native').ViewProps) => <View {...props} />,
    Marker: (props: import('react-native').PressableProps) => <Pressable {...props} />,
  };
});

afterEach(() => jest.clearAllMocks());

it('lists the sample alerts under Near you and shows the demo-zone map without location in preview', async () => {
  await render(<CampusMap store={{ load: async () => sampleAlerts() }} simulated />);
  await screen.findByText('4 active alerts');
  const map = screen.getByLabelText('UF demo zone campus map');
  expect(map.props.initialRegion).toEqual(campusRegion);
  expect(map.props.showsUserLocation).toBe(false);
  expect(screen.getByText(/Invented sample alerts/)).toBeTruthy();
  expect(screen.getByText('Construction: Library West')).toBeTruthy();
});

it('lists Facilities posts apart from student reports (R5)', async () => {
  await render(<CampusMap store={{ load: async () => sampleAlerts() }} />);
  await screen.findByText('4 active alerts');
  expect(screen.getByRole('header', { name: 'UF Facilities · Verified' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Student reports' })).toBeTruthy();
  expect(screen.getByText(/Verified by UF Facilities/)).toBeTruthy();
  expect(screen.getByText(/no confirmations yet/)).toBeTruthy();
});

it('opens an alert from its row or its pin', async () => {
  const alerts = sampleAlerts();
  await render(<CampusMap store={{ load: async () => alerts }} />);
  await screen.findByText('4 active alerts');
  await fireEvent.press(screen.getByRole('button', { name: /^Flooding: CSE Building\./ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/alert/[id]', params: { id: alerts[3]!.id } });
  await fireEvent.press(screen.getByLabelText(/Construction\. .*3 confirmations, verified/));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/alert/[id]', params: { id: alerts[0]!.id } });
});

it('goes to route options, reporting, and profile editing', async () => {
  await render(<CampusMap store={{ load: async () => [] }} profile={{ ...sampleProfile, mode: 'wheelchair' }} />);
  expect(await screen.findByText('Routing for Wheelchair')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Where to?' }));
  expect(router.push).toHaveBeenCalledWith('/routes');
  await fireEvent.press(screen.getByRole('button', { name: 'Report a barrier' }));
  expect(router.navigate).toHaveBeenCalledWith('/report');
  await fireEvent.press(screen.getByRole('link', { name: 'Edit travel profile' }));
  expect(router.navigate).toHaveBeenCalledWith('/profile');
});

it('shows a temporary mode and its end date on the profile chip', async () => {
  const profile = { ...sampleProfile, mode: 'walking' as const, temp_mode: 'walking_aid' as const, temp_until: '2999-01-31' };
  await render(<CampusMap store={{ load: async () => [] }} profile={profile} />);
  expect(await screen.findByText('Walking aid until Jan 31')).toBeTruthy();
});

it('confirms a sent report', async () => {
  await render(<CampusMap store={{ load: async () => [] }} reportedKey="123" />);
  expect(await screen.findByText(/on the map now/)).toBeTruthy();
});

it('shows load errors and can try again', async () => {
  const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(sampleAlerts());
  await render(<CampusMap store={{ load }} />);
  await screen.findByRole('alert');
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
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
