/**
 * Standard error shape returned by the backend API.
 * All error responses conform to this structure.
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId?: string;
}

/**
 * Normalizes error responses from the API into a consistent shape.
 * Handles both fetch errors and API error responses.
 *
 * @param error - The error from an API call (could be fetch error or API error response)
 * @returns Normalized error object with error, message, and optional requestId
 */
export function normalizeApiError(error: unknown): ApiErrorResponse {
  // If it's already an ApiErrorResponse, return it
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    'message' in error
  ) {
    return error as ApiErrorResponse;
  }

  // If it's a fetch error or network error
  if (error instanceof Error) {
    return {
      error: error.name || 'NetworkError',
      message: error.message || 'An unexpected error occurred',
    };
  }

  // If it's an openapi-fetch error response
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    error.error &&
    typeof error.error === 'object'
  ) {
    const apiError = error.error as Record<string, unknown>;
    return {
      error: String(apiError.error || 'UnknownError'),
      message: String(apiError.message || 'An unexpected error occurred'),
      requestId: apiError.requestId ? String(apiError.requestId) : undefined,
    };
  }

  // Fallback for unknown error types
  return {
    error: 'UnknownError',
    message: 'An unexpected error occurred',
  };
}

/**
 * Type guard to check if a response is an error response
 */
export function isApiError(response: unknown): response is ApiErrorResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    'error' in response &&
    'message' in response
  );
}
