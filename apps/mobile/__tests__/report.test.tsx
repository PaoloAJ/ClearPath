import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';

import ReportScreen from '@/app/(tabs)/report';

const mockRpc = jest.fn();
jest.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: 'user_1' }) }));
jest.mock('@/lib/supabase', () => ({ PHOTO_BUCKET: 'report-photos', useSupabase: () => ({ rpc: mockRpc }) }));
jest.mock('@/lib/demo', () => ({ demoEnabled: false, DEMO_REPORT_POINT: { lat: 0, lng: 0 } }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 29.6481, longitude: -82.3437, accuracy: 8 } } as never);
});

it('reports a barrier in two taps with the GPS location (R4)', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await render(<ReportScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Elevator out' }));
  expect(await screen.findByText('Near Marston Science Library')).toBeTruthy();
  expect(screen.getByText('From GPS · accurate to about 8 m')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('report_alert',
    { type: 'elevator_out', lat: 29.6481, lng: -82.3437, photo_path: null }));
  expect(router.navigate).toHaveBeenCalledWith({ pathname: '/', params: { reported: expect.any(String) } });
});

it('finds the location again for each report', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await render(<ReportScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Elevator out' }));
  await screen.findByText('Near Marston Science Library');
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(router.navigate).toHaveBeenCalled());
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 29.6479, longitude: -82.3450, accuracy: 5 } } as never);
  await fireEvent.press(screen.getByRole('button', { name: 'Path blocked' }));
  expect(await screen.findByText('Near CSE Building')).toBeTruthy();
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
});

it('maps Figma tiles onto the alert types the database accepts', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await render(<ReportScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Event or crowd' }));
  await screen.findByText('Near Marston Science Library');
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('report_alert', expect.objectContaining({ type: 'other' })));
});

it('reports flooding, which the Figma tiles left out', async () => {
  mockRpc.mockResolvedValue({ error: null });
  await render(<ReportScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Flooding' }));
  await screen.findByText('Near Marston Science Library');
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('report_alert', expect.objectContaining({ type: 'flooding' })));
});

it('explains an out-of-zone rejection instead of failing silently', async () => {
  mockRpc.mockResolvedValue({ error: { message: 'location is outside the demo zone' } });
  await render(<ReportScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Construction' }));
  await screen.findByText('Near Marston Science Library');
  await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/isn't near a mapped path in the demo zone/);
  expect(router.navigate).not.toHaveBeenCalled();
});

it('asks for location when it is turned off, and lets you change the type', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ granted: false } as never);
  await render(<ReportScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Path blocked' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Location is off/);
  expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Change type' }));
  expect(screen.getByText("What's in the way?")).toBeTruthy();
});
