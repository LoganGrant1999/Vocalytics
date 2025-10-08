#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Start the server
const server = spawn('node', [join(__dirname, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let requestId = 1;

function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params,
  };
  server.stdin.write(JSON.stringify(request) + '\n');
}

let output = '';

server.stdout.on('data', (data) => {
  output += data.toString();
  const lines = output.split('\n');
  output = lines.pop(); // Keep incomplete line

  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

// Initialize
setTimeout(() => {
  console.log('\n=== Test 1: Initialize ===');
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });
}, 100);

// Test with default max (should be 20)
setTimeout(() => {
  console.log('\n=== Test 2: fetch_comments with default max ===');
  sendRequest('tools/call', {
    name: 'fetch_comments',
    arguments: {},
  });
}, 500);

// Test with valid max
setTimeout(() => {
  console.log('\n=== Test 3: fetch_comments with max=5 ===');
  sendRequest('tools/call', {
    name: 'fetch_comments',
    arguments: { max: 5 },
  });
}, 1000);

// Test with invalid max (> 50)
setTimeout(() => {
  console.log('\n=== Test 4: fetch_comments with max=100 (should error) ===');
  sendRequest('tools/call', {
    name: 'fetch_comments',
    arguments: { max: 100 },
  });
}, 1500);

// Cleanup
setTimeout(() => {
  server.kill();
  process.exit(0);
}, 2500);
