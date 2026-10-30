import { useSession } from '@clerk/expo';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

import { env } from './env';

/**
 * Supabase client that sends the current Clerk session token on every request.
 * Supabase trusts Clerk as a third-party auth provider, so RLS sees the Clerk
 * user ID in auth.jwt() ->> 'sub'.
 */
export function useSupabase(): SupabaseClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient(env.supabaseUrl, env.supabaseAnonKey, {
        accessToken: async () => (await session?.getToken()) ?? null,
      }),
    [session],
  );
}

export const PHOTO_BUCKET = 'report-photos';
