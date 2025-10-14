import jwt from 'jsonwebtoken';

// JWT secret - in production, use a strong secret from env
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '30d'; // 30 days

export interface JWTPayload {
  userId: string;
  email: string;
  tier: 'free' | 'pro';
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    issuer: 'vocalytics',
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'vocalytics',
    }) as JWTPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
