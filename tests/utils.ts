/**
 * Test utilities for Vocalytics API testing
 */

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const JWT = process.env.JWT || '';

export interface APIResponse<T = any> {
  status: number;
  data: T;
  headers: Headers;
}

export interface PaywallError {
  code: 'PAYWALL';
  reason: 'FREE_TIER_EXCEEDED';
  feature: 'analyze' | 'reply';
  upgradeUrl: string;
  manageUrl: string;
  limits: {
    weeklyAnalyze: number;
    dailyReply: number;
  };
  usage: {
    commentsAnalyzed: number;
    repliesGenerated: number;
  };
}

export interface TWComment {
  id: string;
  videoId: string;
  author: string;
  text: string;
  publishedAt: string;
  likeCount: number;
  replyCount: number;
  isReply: boolean;
  parentId?: string;
}

/**
 * Make an API request with optional JWT authentication
 */
export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const url = `${BASE_URL}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add JWT if available and not explicitly excluded
  if (JWT && !options.headers?.['Authorization']) {
    headers['Authorization'] = `Bearer ${JWT}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: T;
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text() as T;
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

/**
 * Make an API request without authentication
 */
export async function apiNoAuth<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const url = `${BASE_URL}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: T;
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text() as T;
  }

  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

/**
 * Make an API request with a custom token
 */
export async function apiWithToken<T = any>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  return api<T>(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Poll a condition until it's true or timeout
 */
export async function poll<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: {
    interval?: number;
    timeout?: number;
    timeoutMessage?: string;
  } = {}
): Promise<T> {
  const { interval = 2000, timeout = 30000, timeoutMessage = 'Polling timed out' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await fn();

    if (condition(result)) {
      return result;
    }

    await sleep(interval);
  }

  throw new Error(timeoutMessage);
}

/**
 * Create a test comment
 */
export function createTestComment(overrides: Partial<TWComment> = {}): TWComment {
  return {
    id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    videoId: 'test_video',
    author: 'Test User',
    text: 'This is a test comment',
    publishedAt: new Date().toISOString(),
    likeCount: 0,
    replyCount: 0,
    isReply: false,
    ...overrides,
  };
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Assert that a response has a paywall error structure
 */
export function assertPaywallError(data: any): asserts data is PaywallError {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Expected paywall error to be an object');
  }

  if (data.code !== 'PAYWALL') {
    throw new Error(`Expected code to be "PAYWALL", got "${data.code}"`);
  }

  if (data.reason !== 'FREE_TIER_EXCEEDED') {
    throw new Error(`Expected reason to be "FREE_TIER_EXCEEDED", got "${data.reason}"`);
  }

  if (!['analyze', 'reply'].includes(data.feature)) {
    throw new Error(`Expected feature to be "analyze" or "reply", got "${data.feature}"`);
  }

  if (typeof data.upgradeUrl !== 'string' || !data.upgradeUrl) {
    throw new Error('Expected upgradeUrl to be a non-empty string');
  }

  if (typeof data.manageUrl !== 'string' || !data.manageUrl) {
    throw new Error('Expected manageUrl to be a non-empty string');
  }

  if (!data.limits || typeof data.limits !== 'object') {
    throw new Error('Expected limits to be an object');
  }

  if (!data.usage || typeof data.usage !== 'object') {
    throw new Error('Expected usage to be an object');
  }
}

/**
 * Generate a large payload for testing body limits
 */
export function generateLargePayload(sizeMB: number): string {
  const chunkSize = 1024 * 1024; // 1MB
  const chunks: string[] = [];

  for (let i = 0; i < sizeMB; i++) {
    chunks.push('x'.repeat(chunkSize));
  }

  return chunks.join('');
}

/**
 * Log test info with color
 */
export function logTestInfo(message: string): void {
  console.log(`\x1b[36mℹ ${message}\x1b[0m`);
}

/**
 * Log test warning with color
 */
export function logTestWarn(message: string): void {
  console.log(`\x1b[33m⚠ ${message}\x1b[0m`);
}

/**
 * Log test success with color
 */
export function logTestSuccess(message: string): void {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}
