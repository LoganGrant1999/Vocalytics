import '@testing-library/jest-dom';
import { server, resetAnalysisCache } from './server';

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset any request handlers that are declared as a part of the tests
// (this is important for test isolation)
afterEach(() => {
  server.resetHandlers();
  resetAnalysisCache();
});

// Clean up after tests are finished
afterAll(() => server.close());
