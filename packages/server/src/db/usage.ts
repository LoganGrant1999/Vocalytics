import { supabase } from './client.js';

export async function recordUsage(params: {
  userId: string;
  action: 'analyze' | 'reply';
  count: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { userId, action, count, metadata } = params;

  const { error } = await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      action,
      count,
      metadata: metadata || null
    });

  if (error) throw error;
}

export async function tryConsumeAnalyze(params: {
  userDbId: string;
  cap: number;
  incrementBy: number;
}): Promise<{ allowed: true; newCount: number } | { allowed: false }> {
  const { userDbId, cap, incrementBy } = params;

  // Note: incrementBy must be 1 for atomic function to work correctly
  // If incrementBy > 1, we need to call the function multiple times or extend the SQL function
  if (incrementBy !== 1) {
    throw new Error('Atomic quota consumption only supports incrementBy=1');
  }

  // Call atomic Postgres function
  const { data, error } = await supabase
    .rpc('consume_analyze_quota', {
      _user_id: userDbId,
      _cap: cap
    });

  if (error) throw error;

  // Function returns a row if allowed, empty if not
  if (data && data.length > 0 && data[0].allowed) {
    // Record usage event
    await recordUsage({
      userId: userDbId,
      action: 'analyze',
      count: incrementBy,
      metadata: { tier: 'free' }
    });

    return { allowed: true, newCount: data[0].new_count };
  }

  return { allowed: false };
}

export async function tryConsumeReply(params: {
  userDbId: string;
  cap: number;
  incrementBy: number;
}): Promise<{ allowed: true; newCount: number } | { allowed: false }> {
  const { userDbId, cap, incrementBy } = params;

  // Note: incrementBy must be 1 for atomic function to work correctly
  if (incrementBy !== 1) {
    throw new Error('Atomic quota consumption only supports incrementBy=1');
  }

  // Call atomic Postgres function
  const { data, error } = await supabase
    .rpc('consume_reply_quota', {
      _user_id: userDbId,
      _cap: cap
    });

  if (error) throw error;

  // Function returns a row if allowed, empty if not
  if (data && data.length > 0 && data[0].allowed) {
    // Record usage event
    await recordUsage({
      userId: userDbId,
      action: 'reply',
      count: incrementBy,
      metadata: { tier: 'free' }
    });

    return { allowed: true, newCount: data[0].new_count };
  }

  return { allowed: false };
}

export async function incrementUsage(params: {
  userId: string;
  action: 'analyze' | 'reply';
  incrementBy: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { userId, action, incrementBy, metadata } = params;

  // Use a transaction to ensure atomic read-increment-write
  const field = action === 'analyze' ? 'comments_analyzed_count' : 'replies_generated_count';

  // Fetch current value and increment in a single query
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select(field)
    .eq('id', userId)
    .single();

  if (fetchError) throw fetchError;
  if (!user) throw new Error('User not found');

  const newValue = (user[field as keyof typeof user] as number) + incrementBy;

  const { error: updateError } = await supabase
    .from('users')
    .update({ [field]: newValue })
    .eq('id', userId);

  if (updateError) throw updateError;

  // Record the usage event
  await recordUsage({ userId, action, count: incrementBy, metadata });
}
