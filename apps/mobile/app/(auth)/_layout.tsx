import { useAuth } from '@clerk/expo';
import { Redirect, Stack, useSegments } from 'expo-router';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href={segments.some((segment) => segment === 'sign-up') ? '/profile' : '/'} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
