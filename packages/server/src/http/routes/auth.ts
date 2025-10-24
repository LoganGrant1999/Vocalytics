import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { generateToken } from '../../lib/jwt.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function publicAuthRoutes(fastify: FastifyInstance) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  /**
   * POST /api/auth/register
   * Register new user with email/password
   */
  fastify.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('[auth.ts] Register request received');
      console.log('[auth.ts] Request body:', JSON.stringify(request.body));
      const body = registerSchema.parse(request.body);

      // Check if email already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', body.email)
        .single();

      if (existing) {
        return reply.code(400).send({
          error: 'Email already exists',
          message: 'An account with this email already exists',
        });
      }

      // Hash password
      const password_hash = await bcrypt.hash(body.password, 10);

      // Create user
      const { data: newUser, error: createError } = await supabase
        .from('profiles')
        .insert({
          email: body.email,
          name: `${body.firstName} ${body.lastName}`,
          password_hash,
          tier: 'free',
          email_verified: false,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('[auth.ts] Failed to create user:', createError);
        return reply.code(500).send({
          error: 'Registration failed',
          message: 'Failed to create user account',
        });
      }

      // Clear any existing session cookie first
      reply.clearCookie('vocalytics_token', {
        path: '/',
      });

      // Generate JWT token for the NEW user
      const jwtToken = generateToken({
        userId: newUser.id,
        email: newUser.email!,
        tier: newUser.tier as 'free' | 'pro',
      });

      // Set JWT as HTTP-only cookie
      reply.setCookie('vocalytics_token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return reply.send({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          tier: newUser.tier,
          emailVerified: newUser.email_verified,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          message: error.errors[0]?.message || 'Validation failed',
        });
      }

      console.error('[auth.ts] Register error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to register user',
      });
    }
  });

  /**
   * POST /api/auth/login
   * Login with email/password
   */
  fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Find user by email
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', body.email)
        .single();

      if (userError || !user) {
        return reply.code(401).send({
          error: 'Invalid credentials',
          message: 'Invalid email or password',
        });
      }

      // Check if user registered with OAuth (no password hash)
      if (!user.password_hash) {
        return reply.code(400).send({
          error: 'OAuth account',
          message: 'This account was created with Google. Please sign in with Google.',
        });
      }

      // Verify password
      const valid = await bcrypt.compare(body.password, user.password_hash);

      if (!valid) {
        return reply.code(401).send({
          error: 'Invalid credentials',
          message: 'Invalid email or password',
        });
      }

      // Update last login
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      // Clear any existing session cookie first
      reply.clearCookie('vocalytics_token', {
        path: '/',
      });

      // Generate JWT token
      const jwtToken = generateToken({
        userId: user.id,
        email: user.email!,
        tier: user.tier as 'free' | 'pro',
      });

      // Set JWT as HTTP-only cookie
      reply.setCookie('vocalytics_token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          emailVerified: user.email_verified,
          hasYouTubeConnected: !!user.youtube_access_token,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          message: error.errors[0]?.message || 'Validation failed',
        });
      }

      console.error('[auth.ts] Login error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to login',
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout and clear session cookie
   */
  fastify.post('/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Clear the cookie
    reply.clearCookie('vocalytics_token', {
      path: '/',
    });

    return reply.send({ message: 'Logged out successfully' });
  });
}

/**
 * Protected auth routes (require authentication)
 */
export async function protectedAuthRoutes(fastify: FastifyInstance) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  /**
   * GET /api/auth/me
   * Get current user info (requires auth)
   */
  fastify.get('/auth/me', async (request: any, reply: FastifyReply) => {
    const userId = request.auth?.userId || request.auth?.userDbId || request.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const { data: user } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar_url,
          tier: user.tier,
          emailVerified: user.email_verified,
          hasYouTubeConnected: !!user.youtube_access_token,
          createdAt: user.created_at,
        },
      });
    } catch (error: any) {
      console.error('[auth.ts] Get me error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to get user info',
      });
    }
  });
}
