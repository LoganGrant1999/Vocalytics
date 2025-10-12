import { supabase } from './client.js';

export async function recordStripeEvent(params: {
  eventId: string;
  type: string;
  payload: Record<string, any>;
}): Promise<{ isNew: boolean }> {
  const { eventId, type, payload } = params;

  // Try to insert, ignore if duplicate
  const { error } = await supabase
    .from('stripe_events')
    .insert({
      event_id: eventId,
      type,
      payload,
      processed: false
    });

  if (error) {
    // Duplicate key violation means we've seen this event before
    if (error.code === '23505') {
      return { isNew: false };
    }
    throw error;
  }

  return { isNew: true };
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_events')
    .update({ processed: true })
    .eq('event_id', eventId);

  if (error) throw error;
}
