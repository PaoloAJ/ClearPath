import * as SecureStore from 'expo-secure-store';

import { fixtureProfileStore, resetSampleProfile } from '@/lib/fixtures';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

let saved: string | null;
beforeEach(() => {
  saved = null;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => saved);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => { saved = value; });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => { saved = null; });
});

it('reloads a sample selection from device storage and can reset it', async () => {
  expect((await fixtureProfileStore.load())?.mode).toBe('walking');
  await fixtureProfileStore.save('scooter', null);
  expect((await fixtureProfileStore.load())?.mode).toBe('scooter');
  await resetSampleProfile();
  expect((await fixtureProfileStore.load())?.mode).toBe('walking');
});

it('rejects an invalid stored mode instead of displaying it', async () => {
  saved = JSON.stringify({ mode: 'invalid' });
  await expect(fixtureProfileStore.load()).rejects.toThrow('sample profile');
});
