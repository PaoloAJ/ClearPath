import { env } from '@/lib/env';

// Fixture previews bypass authentication; backend demos must keep the real app.
export const previewEnabled = __DEV__ && env.fixturePreview;
