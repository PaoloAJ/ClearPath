// Expo inlines EXPO_PUBLIC_* at build time, so each one must be read with a literal key.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in.`);
  }
  return value;
}

export const env = {
  clerkPublishableKey: required(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  routingApiUrl: required('EXPO_PUBLIC_ROUTING_API_URL', process.env.EXPO_PUBLIC_ROUTING_API_URL),
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
};
