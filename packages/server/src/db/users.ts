import { supabase, type User } from './client.js';

export async function upsertUser(params: {
  appUserId: string;
  email?: string | null;
}): Promise<User> {
  const { appUserId, email } = params;

  // Try to find existing user
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('app_user_id', appUserId)
    .single();

  if (existing) {
    // Update email if provided and different
    if (email && email !== existing.email) {
      const { data, error } = await supabase
        .from('users')
        .update({ email })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
    return existing;
  }

  // Create new user
  const { data, error } = await supabase
    .from('users')
    .insert({
      app_user_id: appUserId,
      email: email || null,
      tier: 'free',
      comments_analyzed_count: 0,
      replies_generated_count: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export async function getUserByAppUserId(appUserId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('app_user_id', appUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

export async function updateUserStripe(params: {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscribedUntil?: Date | null;
  tier?: 'free' | 'pro';
}): Promise<User> {
  const updates: Partial<User> = {};

  if (params.stripeCustomerId !== undefined) {
    updates.stripe_customer_id = params.stripeCustomerId;
  }
  if (params.stripeSubscriptionId !== undefined) {
    updates.stripe_subscription_id = params.stripeSubscriptionId;
  }
  if (params.subscriptionStatus !== undefined) {
    updates.subscription_status = params.subscriptionStatus;
  }
  if (params.subscribedUntil !== undefined) {
    updates.subscribed_until = params.subscribedUntil?.toISOString() || null;
  }
  if (params.tier !== undefined) {
    updates.tier = params.tier;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', params.userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
