import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'ClearPath',
  slug: 'clearpath',
  scheme: 'clearpath',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'edu.ufl.clearpath',
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'ClearPath uses your location to plan accessible routes and to place barrier reports.',
    },
  },
  android: {
    package: 'edu.ufl.clearpath',
    permissions: ['ACCESS_FINE_LOCATION', 'VIBRATE'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'ClearPath uses your location to plan accessible routes and to place barrier reports.',
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'Add an optional photo to a barrier report.',
        photosPermission: 'Add an optional photo to a barrier report.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
