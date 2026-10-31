import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { TravelProfile } from '@/components/TravelProfile';
import { sampleProfile } from '@/lib/fixtures';
import type { ProfileStore } from '@/lib/profile';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

function storeFor(profile = sampleProfile) {
  return {
    load: jest.fn().mockResolvedValue(profile),
    save: jest.fn().mockImplementation(async (mode) => ({ ...profile, mode })),
  } satisfies ProfileStore;
}

it('loads a saved mode and allows switching and saving it', async () => {
  const store = storeFor();
  await render(<TravelProfile store={store} />);
  await screen.findByRole('radio', { name: 'Walking', checked: true });
  await fireEvent.press(screen.getByRole('radio', { name: 'Wheelchair' }));
  expect(screen.getByRole('radio', { name: 'Wheelchair', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Walking', checked: false })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save travel profile' }));
  await screen.findByText('Travel profile saved.');
  expect(store.save).toHaveBeenCalledWith('wheelchair', sampleProfile);
});

it('requires a deliberate choice for a new profile', async () => {
  const store = storeFor();
  store.load.mockResolvedValue(null);
  await render(<TravelProfile store={store} />);
  const save = await screen.findByRole('button', { name: 'Save travel profile' });
  expect(save).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Walking aid' }));
  await fireEvent.press(save);
  await waitFor(() => expect(store.save).toHaveBeenCalledWith('walking_aid', null));
});

it('keeps the selection after a failed save and supports retry', async () => {
  const store = storeFor();
  store.save.mockRejectedValueOnce(new Error('offline'));
  await render(<TravelProfile store={store} />);
  await screen.findByRole('radio', { name: 'Bike' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Bike' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save travel profile' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('radio', { name: 'Bike', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save travel profile' }));
  await screen.findByText('Travel profile saved.');
});

it('blocks editing after a load error and allows retry', async () => {
  const store = storeFor();
  store.load.mockRejectedValueOnce(new Error('offline'));
  await render(<TravelProfile store={store} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Save travel profile' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try loading again' }));
  await screen.findByRole('radio', { name: 'Walking', checked: true });
});

it('clearly identifies device-only simulated saves', async () => {
  await render(<TravelProfile store={storeFor()} simulated />);
  await screen.findByRole('button', { name: 'Save travel profile' });
  await fireEvent.press(screen.getByRole('button', { name: 'Save travel profile' }));
  await screen.findByText('Sample profile saved on this device. No account was updated.');
});
