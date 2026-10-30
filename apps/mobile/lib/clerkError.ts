import { isClerkAPIResponseError } from '@clerk/expo';

/** Prefer `longMessage`: Clerk's `message` is often a short fragment like "is incorrect". */
export function firstClerkErrorMessage(err: unknown): string | undefined {
  if (!isClerkAPIResponseError(err)) return undefined;
  const first = err.errors[0];
  return first?.longMessage ?? first?.message;
}
