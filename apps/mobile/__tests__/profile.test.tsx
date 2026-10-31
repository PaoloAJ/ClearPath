import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { TravelProfile } from '@/components/TravelProfile';
import { sampleProfile } from '@/lib/fixtures';
import type { ProfileStore } from '@/lib/profile';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

function storeFor(profile = sampleProfile) {
  return {
    load: jest.fn().mockResolvedValue(profile),
    save: jest.fn().mockImplementation(async (mode, _existing, extras) => ({ ...profile, ...extras, mode })),
  } satisfies ProfileStore;
}

it('loads a saved mode and allows switching and saving it', async () => {
  const store = storeFor();
  await render(<TravelProfile store={store} />);
  await screen.findByRole('radio', { name: 'Walking', checked: true });
  await fireEvent.press(screen.getByRole('radio', { name: 'Wheelchair' }));
  expect(screen.getByRole('radio', { name: 'Wheelchair', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Walking', checked: false })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await screen.findByText('Travel profile saved.');
  expect(store.save).toHaveBeenCalledWith('wheelchair', sampleProfile, { temp_mode: null, temp_until: null, haptics_only: false });
});

it('requires a deliberate choice for a new profile', async () => {
  const store = storeFor();
  store.load.mockResolvedValue(null);
  await render(<TravelProfile store={store} />);
  const save = await screen.findByRole('button', { name: 'Save and open map' });
  expect(save).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Walking aid' }));
  await fireEvent.press(save);
  await waitFor(() => expect(store.save).toHaveBeenCalledWith('walking_aid', null, expect.objectContaining({ temp_mode: null })));
});

it('keeps the selection after a failed save and supports retry', async () => {
  const store = storeFor();
  store.save.mockRejectedValueOnce(new Error('offline'));
  await render(<TravelProfile store={store} />);
  await screen.findByRole('radio', { name: 'Bike' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Bike' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('radio', { name: 'Bike', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await screen.findByText('Travel profile saved.');
});

it('blocks editing after a load error and allows retry', async () => {
  const store = storeFor();
  store.load.mockRejectedValueOnce(new Error('offline'));
  await render(<TravelProfile store={store} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Save and open map' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try loading again' }));
  await screen.findByRole('radio', { name: 'Walking', checked: true });
});

it('clearly identifies device-only simulated saves', async () => {
  await render(<TravelProfile store={storeFor()} simulated />);
  await screen.findByRole('button', { name: 'Save and open map' });
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await screen.findByText('Sample profile saved on this device. No account was updated.');
});

it('saves a temporary mode that switches back to the usual one', async () => {
  const store = storeFor({ ...sampleProfile, mode: 'walking' });
  const onSaved = jest.fn();
  await render(<TravelProfile store={store} onSaved={onSaved} />);
  await screen.findByRole('radio', { name: 'Walking', checked: true });
  await fireEvent.press(screen.getByRole('radio', { name: 'Walking aid' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'This is temporary (like an injury)' }));
  expect(screen.getByRole('button', { name: 'Save and open map' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: '6 weeks' }));
  expect(screen.getByText(/Routes use Walking aid until .*, then switch back to Walking\./)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await waitFor(() => expect(store.save).toHaveBeenCalledWith('walking', expect.anything(),
    expect.objectContaining({ temp_mode: 'walking_aid', temp_until: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })));
  expect(onSaved).toHaveBeenCalled();
});

it('needs a usual mode before a temporary one', async () => {
  const store = storeFor();
  store.load.mockResolvedValue(null);
  await render(<TravelProfile store={store} />);
  const temporary = await screen.findByRole('checkbox', { name: 'This is temporary (like an injury)' });
  expect(temporary).toBeDisabled();
  expect(screen.getByText(/Save your usual mode first/)).toBeTruthy();
});

it('saves the haptics-only preference', async () => {
  const store = storeFor();
  await render(<TravelProfile store={store} />);
  await fireEvent.press(await screen.findByRole('checkbox', { name: /Vibrate and speak new alerts/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await waitFor(() => expect(store.save).toHaveBeenCalledWith('walking', sampleProfile, expect.objectContaining({ haptics_only: true })));
});

it('goes back to the usual mode when a temporary one is turned off', async () => {
  const store = storeFor({ ...sampleProfile, mode: 'wheelchair', temp_mode: 'walking_aid', temp_until: '2999-01-31' });
  await render(<TravelProfile store={store} />);
  await screen.findByRole('radio', { name: 'Walking aid', checked: true });
  await fireEvent.press(screen.getByRole('checkbox', { name: 'This is temporary (like an injury)' }));
  expect(screen.getByRole('radio', { name: 'Wheelchair', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save and open map' }));
  await waitFor(() => expect(store.save).toHaveBeenCalledWith('wheelchair', expect.anything(),
    expect.objectContaining({ temp_mode: null, temp_until: null })));
});
