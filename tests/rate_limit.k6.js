/**
 * k6 Load Test - Rate Limiting
 * Tests rate limiting if implemented (optional)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp up to 10 VUs
    { duration: '20s', target: 10 }, // Stay at 10 VUs
    { duration: '10s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT = __ENV.JWT || '';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/healthz`);

  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // Test authenticated endpoint if JWT available
  if (JWT) {
    const headers = {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json',
    };

    const payload = JSON.stringify({
      comments: [
        {
          id: `k6_${Date.now()}_${Math.random()}`,
          videoId: 'test',
          author: 'k6 User',
          text: 'Load test comment',
          publishedAt: new Date().toISOString(),
          likeCount: 0,
          replyCount: 0,
          isReply: false,
        },
      ],
    });

    const analyzeRes = http.post(
      `${BASE_URL}/api/analyze-comments`,
      payload,
      { headers }
    );

    check(analyzeRes, {
      'analyze status is 200, 402, or 429': (r) =>
        [200, 402, 429].includes(r.status),
      'response time < 2s': (r) => r.timings.duration < 2000,
    });

    // Check for rate limiting
    if (analyzeRes.status === 429) {
      console.log('✓ Rate limiting is active (429 received)');
    }
  }

  sleep(1);
}

export function handleSummary(data) {
  console.log('\n📊 k6 Load Test Summary');
  console.log(`Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Duration: ${data.metrics.http_req_duration.values.avg}ms avg`);
  console.log(`Failed: ${data.metrics.http_req_failed.values.passes || 0}`);

  const rate429 = data.metrics.http_reqs.values.count > 0
    ? (data.metrics['http_req_status{status:429}']?.values?.count || 0)
    : 0;

  if (rate429 > 0) {
    console.log(`\n✓ Rate limiting detected: ${rate429} requests got 429`);
  } else {
    console.log('\n⚠️  No rate limiting detected (429 responses)');
    console.log('   This is acceptable if rate limiting is not implemented');
  }

  return {
    stdout: '',
  };
}
