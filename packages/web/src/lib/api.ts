import createClient from 'openapi-fetch';
import type { paths } from '@/types/api';
import { requestStore } from './requestStore';

/**
 * Typed API client for the Vocalytics backend.
 * All requests are made to /api/* which is proxied to the backend server.
 * Automatically tracks requests for debugging.
 */
const client = createClient<paths>({
  baseUrl: '/api',
});

// Middleware to track all requests
client.use({
  async onResponse({ response, request }) {
    const requestId = response.headers.get('x-request-id');
    const method = request.method;
    const path = new URL(request.url).pathname;

    requestStore.add({
      method,
      path,
      status: response.status,
      requestId,
      timestamp: new Date(),
    });

    return response;
  },
});

export const api = client;

/**
 * Helper type for extracting response data from a successful API call
 */
export type ApiResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: { 200: { content: { 'application/json': infer T } } } }
  ? T
  : never;

/**
 * Helper type for extracting error response from API calls
 */
export type ApiError<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends {
  responses: infer Responses;
}
  ? Responses extends Record<number, unknown>
    ? {
        [K in keyof Responses]: K extends `${4 | 5}${number}`
          ? Responses[K] extends { content: { 'application/json': infer E } }
            ? E
            : never
          : never;
      }[keyof Responses]
    : never
  : never;
