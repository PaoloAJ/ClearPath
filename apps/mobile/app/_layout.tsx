import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { env } from '@/lib/env';

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="alert/[id]" options={{ title: 'Alert' }} />
        <Stack.Screen name="routes" options={{ title: 'Route options' }} />
        <Stack.Screen name="navigate" options={{ title: 'Navigation', headerBackTitle: 'Routes' }} />
      </Stack>
    </ClerkProvider>
  );
}
