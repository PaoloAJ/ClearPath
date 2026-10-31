import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  Figtree_400Regular,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { env } from '@/lib/env';
import { previewEnabled } from '@/lib/preview';
import { FrontendPreview } from '@/components/FrontendPreview';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
  });

  // A failed font load falls back to the system font rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;
  if (previewEnabled) return <FrontendPreview />;
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alert/[id]" />
        <Stack.Screen name="routes" />
        <Stack.Screen name="navigate" options={{ gestureEnabled: false }} />
      </Stack>
    </ClerkProvider>
  );
}
