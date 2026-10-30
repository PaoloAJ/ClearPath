import { useAuth } from '@clerk/expo';
import { Redirect, Tabs } from 'expo-router';

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  // TODO(frontend): tab icons with accessibilityLabel on each tab button.
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Map' }} />
      <Tabs.Screen name="elevators" options={{ title: 'Elevators' }} />
      <Tabs.Screen name="report" options={{ title: 'Report' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
