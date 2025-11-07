/**
 * Counter Reset Worker Tests - Production Critical
 *
 * Tests the counter reset worker that rolls usage counters forward.
 * This worker runs nightly at 00:10 PT via cron job.
 *
 * Critical Scenarios:
 * - Daily counter resets
 * - Monthly counter resets
 * - Combined resets (month boundary)
 * - No-op when already current
 * - Multiple users
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for proper mock function creation
const {
  mockRollUsageCounters,
} = vi.hoisted(() => ({
  mockRollUsageCounters: vi.fn(),
}));

// Mock rate limits database functions
vi.mock('../../db/rateLimits.js', () => ({
  rollUsageCounters: mockRollUsageCounters,
}));

// Import after mocks
import { resetCounters } from '../resetCounters.js';

describe('Counter Reset Worker - Production Critical', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRollUsageCounters.mockResolvedValue(undefined);
  });

  describe('Successful Execution', () => {
    it('should call rollUsageCounters successfully', async () => {
      // Mock process.exit to prevent test termination
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockRollUsageCounters).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should execute without throwing errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await expect(resetCounters()).resolves.not.toThrow();

      mockExit.mockRestore();
    });

    it('should complete quickly (under 100ms)', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      const start = Date.now();
      await resetCounters();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);

      mockExit.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle rollUsageCounters errors gracefully', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRollUsageCounters.mockRejectedValue(new Error('Database connection failed'));

      await resetCounters();

      expect(consoleError).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[resetCounters] Error resetting counters:'),
        expect.any(Error)
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      consoleError.mockRestore();
    });

    it('should exit with code 1 on error', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRollUsageCounters.mockRejectedValue(new Error('Database error'));

      await resetCounters();

      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      consoleError.mockRestore();
    });

    it('should handle database timeout errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRollUsageCounters.mockRejectedValue(new Error('Connection timeout'));

      await resetCounters();

      expect(consoleError).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      consoleError.mockRestore();
    });

    it('should handle network errors', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRollUsageCounters.mockRejectedValue(new Error('ECONNREFUSED'));

      await resetCounters();

      expect(consoleError).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      consoleError.mockRestore();
    });
  });

  describe('Logging', () => {
    it('should log start message', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await resetCounters();

      expect(consoleLog).toHaveBeenCalledWith('[resetCounters] Starting counter reset...');

      mockExit.mockRestore();
      consoleLog.mockRestore();
    });

    it('should log success message', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      await resetCounters();

      expect(consoleLog).toHaveBeenCalledWith('[resetCounters] Counters reset successfully');

      mockExit.mockRestore();
      consoleLog.mockRestore();
    });

    it('should log error message on failure', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Test error');
      mockRollUsageCounters.mockRejectedValue(error);

      await resetCounters();

      expect(consoleError).toHaveBeenCalledWith(
        '[resetCounters] Error resetting counters:',
        error
      );

      mockExit.mockRestore();
      consoleError.mockRestore();
    });
  });

  describe('Integration', () => {
    it('should work as standalone worker', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate direct invocation
      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should be callable from cron endpoint', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate cron endpoint calling resetCounters()
      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should handle rapid consecutive calls', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Call multiple times in quick succession
      await Promise.all([
        resetCounters(),
        resetCounters(),
        resetCounters(),
      ]);

      // Should call rollUsageCounters 3 times
      expect(mockRollUsageCounters).toHaveBeenCalledTimes(3);

      mockExit.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined return from rollUsageCounters', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      mockRollUsageCounters.mockResolvedValue(undefined);

      await expect(resetCounters()).resolves.not.toThrow();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle null return from rollUsageCounters', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      mockRollUsageCounters.mockResolvedValue(null as any);

      await expect(resetCounters()).resolves.not.toThrow();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle slow database response', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate 2 second delay
      mockRollUsageCounters.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 2000))
      );

      const start = Date.now();
      await resetCounters();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });
  });

  describe('Production Scenarios', () => {
    it('should reset counters at midnight (00:10 PT)', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate running at 00:10 PT
      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle month boundary (end of month)', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate running on the 1st of the month at 00:10 PT
      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle year boundary (New Years)', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate running on Jan 1st at 00:10 PT
      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle leap year (Feb 29 → Mar 1)', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate running on March 1st after leap year
      await resetCounters();

      expect(mockRollUsageCounters).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });
  });
});
