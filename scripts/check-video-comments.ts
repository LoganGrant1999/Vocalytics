import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVideoComments() {
  const email = 'logangibbons1999@gmail.com';
  const videoId = 'Z3RnJ0YZkRY';

  // Get user ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) {
    console.log('User not found');
    return;
  }

  const userId = profile.id;
  console.log(`User ID: ${userId}`);
  console.log(`Video ID: ${videoId}\n`);

  // Get all comments for this video
  const { data: comments } = await supabase
    .from('comment_scores')
    .select('*')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .order('priority_score', { ascending: false });

  console.log(`📊 ALL comments from video ${videoId}:`);
  console.log(`  Total: ${comments?.length || 0}\n`);

  // Separate top-level from replies
  const topLevel = comments?.filter(c => !c.comment_id.includes('.'));
  const replies = comments?.filter(c => c.comment_id.includes('.'));

  console.log(`📝 Top-level comments (should show in inbox):`);
  console.log(`  Total: ${topLevel?.length || 0}\n`);

  topLevel?.forEach((item, i) => {
    console.log(`${i + 1}. ID: ${item.comment_id}`);
    console.log(`   Score: ${item.priority_score}`);
    console.log(`   Text: "${item.comment_text}"`);
    console.log(`   Author: ${item.author_name}`);
    console.log(`   Sentiment: ${item.sentiment}`);
    console.log(`   Dismissed: ${item.dismissed}`);
    console.log(`   Has suggested_reply: ${item.suggested_reply ? 'YES' : 'NO'}`);
    console.log(`   Reasons: ${item.reasons?.join(', ')}`);
    console.log('');
  });

  console.log(`💬 Reply comments (filtered out of inbox):`);
  console.log(`  Total: ${replies?.length || 0}\n`);

  replies?.forEach((item, i) => {
    console.log(`${i + 1}. ID: ${item.comment_id}`);
    console.log(`   Text: "${item.comment_text?.substring(0, 60)}..."`);
    console.log('');
  });
}

checkVideoComments().catch(console.error);
