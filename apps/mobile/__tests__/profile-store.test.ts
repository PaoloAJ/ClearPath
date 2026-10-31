import type { SupabaseClient } from '@supabase/supabase-js';

import { sampleProfile } from '@/lib/fixtures';
import { createProfileStore } from '@/lib/profile';

jest.mock('expo-secure-store', () => ({}));

function setup() {
  const single = jest.fn().mockResolvedValue({ data: sampleProfile, error: null });
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq, single }));
  const upsert = jest.fn(() => ({ select }));
  const from = jest.fn(() => ({ select, upsert }));
  const client = { from } as unknown as SupabaseClient;
  return { store: createProfileStore(client, 'user_test'), from, upsert, eq, maybeSingle, single };
}

it('reads only the signed-in user and supports first-time setup', async () => {
  const { store, from, eq } = setup();
  expect(await store.load()).toBeNull();
  expect(from).toHaveBeenCalledWith('profiles');
  expect(eq).toHaveBeenCalledWith('user_id', 'user_test');
});

it('upserts by user ID and preserves existing temporary settings', async () => {
  const { store, upsert } = setup();
  await store.save('bike', { ...sampleProfile, temp_mode: 'walking_aid', temp_until: '2026-12-10', haptics_only: true });
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: 'user_test', mode: 'bike', temp_mode: 'walking_aid', temp_until: '2026-12-10', haptics_only: true,
  }), { onConflict: 'user_id' });
});

it('propagates database failures instead of reporting a successful save', async () => {
  const { store, single } = setup();
  single.mockResolvedValue({ data: null, error: { message: 'denied' } });
  await expect(store.save('wheelchair', null)).rejects.toThrow('Could not save');
});
