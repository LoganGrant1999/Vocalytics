import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

// Service-role client bypasses RLS
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types
export interface User {
  id: string;
  app_user_id: string | null;
  email: string | null;
  tier: 'free' | 'pro';
  comments_analyzed_count: number;
  replies_generated_count: number;
  reset_date: string | null;
  subscribed_until: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageEvent {
  id: number;
  user_id: string;
  action: 'analyze' | 'reply';
  count: number;
  metadata: Record<string, any> | null;
  timestamp: string;
}

export interface StripeEvent {
  id: number;
  event_id: string;
  type: string;
  payload: Record<string, any>;
  processed: boolean;
  created_at: string;
}
