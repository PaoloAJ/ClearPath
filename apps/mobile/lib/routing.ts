import { useAuth } from '@clerk/expo';
import { useCallback } from 'react';

import { env } from './env';
import type { RouteCheckRequest, RouteCheckResponse, RouteRequest, RouteResponse } from './types';

export class RoutingError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown, token: string | null): Promise<T> {
  const res = await fetch(`${env.routingApiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new RoutingError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

/** Go routing API client, authenticated with the current Clerk session token. */
export function useRoutingApi() {
  const { getToken } = useAuth();

  const getRoutes = useCallback(
    async (req: RouteRequest) => post<RouteResponse>('/v1/routes', req, await getToken()),
    [getToken],
  );

  const checkRoute = useCallback(
    async (req: RouteCheckRequest) => post<RouteCheckResponse>('/v1/routes/check', req, await getToken()),
    [getToken],
  );

  return { getRoutes, checkRoute };
}
