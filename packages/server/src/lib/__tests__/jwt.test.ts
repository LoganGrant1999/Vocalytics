import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken, JWTPayload } from '../jwt.js';

describe('jwt.ts', () => {
  const mockPayload: JWTPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    tier: 'free',
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockPayload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const payload1: JWTPayload = {
        userId: 'user-1',
        email: 'user1@example.com',
        tier: 'free',
      };

      const payload2: JWTPayload = {
        userId: 'user-2',
        email: 'user2@example.com',
        tier: 'pro',
      };

      const token1 = generateToken(payload1);
      const token2 = generateToken(payload2);

      expect(token1).not.toBe(token2);
    });

    it('should include all payload fields', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.tier).toBe(mockPayload.tier);
    });

    it('should support both free and pro tiers', () => {
      const freePayload: JWTPayload = { ...mockPayload, tier: 'free' };
      const proPayload: JWTPayload = { ...mockPayload, tier: 'pro' };

      const freeToken = generateToken(freePayload);
      const proToken = generateToken(proPayload);

      const decodedFree = verifyToken(freeToken);
      const decodedPro = verifyToken(proToken);

      expect(decodedFree?.tier).toBe('free');
      expect(decodedPro?.tier).toBe('pro');
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.email).toBe(mockPayload.email);
      expect(decoded?.tier).toBe(mockPayload.tier);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = verifyToken(invalidToken);

      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = verifyToken('');

      expect(decoded).toBeNull();
    });

    it('should return null for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';
      const decoded = verifyToken(malformedToken);

      expect(decoded).toBeNull();
    });

    it('should return null for token with wrong signature', () => {
      // Generate a token and then modify it slightly
      const token = generateToken(mockPayload);
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.wrongsignature`;

      const decoded = verifyToken(tamperedToken);

      expect(decoded).toBeNull();
    });

    it('should round-trip token generation and verification', () => {
      const testCases: JWTPayload[] = [
        { userId: 'abc-123', email: 'test1@example.com', tier: 'free' },
        { userId: 'def-456', email: 'test2@example.com', tier: 'pro' },
        { userId: 'ghi-789', email: 'test3@example.com', tier: 'free' },
      ];

      testCases.forEach(payload => {
        const token = generateToken(payload);
        const decoded = verifyToken(token);

        expect(decoded).not.toBeNull();
        expect(decoded?.userId).toBe(payload.userId);
        expect(decoded?.email).toBe(payload.email);
        expect(decoded?.tier).toBe(payload.tier);
      });
    });
  });

  describe('token expiration', () => {
    it('should include expiration in token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      // JWT library adds exp field automatically
      expect((decoded as any).exp).toBeDefined();
      expect((decoded as any).exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should include issuer in token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);

      expect(decoded).not.toBeNull();
      expect((decoded as any).iss).toBe('vocalytics');
    });
  });
});
