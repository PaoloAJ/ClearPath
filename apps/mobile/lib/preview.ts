// Reuse the documented demo flag; release builds always keep the real auth flow.
export const previewEnabled = __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
