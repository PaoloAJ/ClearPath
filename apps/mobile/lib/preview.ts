// Reuse the documented demo flag; release builds always keep the real auth flow.
import { env } from '@/lib/env';

export const previewEnabled = __DEV__ && env.demoMode;
