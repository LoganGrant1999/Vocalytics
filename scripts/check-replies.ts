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

async function checkReplies() {
  const email = 'logangibbons1999@gmail.com';

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
  console.log(`User ID: ${userId}\n`);

  // Query all comment scores with suggested replies
  const { data: allWithReplies, error: allError } = await supabase
    .from('comment_scores')
    .select('comment_id, suggested_reply, dismissed')
    .eq('user_id', userId)
    .not('suggested_reply', 'is', null);

  console.log(`📊 All comments with suggested_reply:`);
  console.log(`  Total: ${allWithReplies?.length || 0}`);
  if (allError) console.log(`  Error:`, allError);

  allWithReplies?.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.comment_id} (dismissed: ${item.dismissed})`);
  });

  // Check posted_replies table
  const { data: postedReplies } = await supabase
    .from('posted_replies')
    .select('comment_id')
    .eq('user_id', userId);

  console.log(`\n📮 Posted replies:`);
  console.log(`  Total: ${postedReplies?.length || 0}`);
  postedReplies?.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.comment_id}`);
  });

  // Filter logic (same as dashboard-stats endpoint)
  let repliesReady = allWithReplies || [];
  if (allWithReplies && allWithReplies.length > 0) {
    const repliedCommentIds = new Set((postedReplies || []).map(r => r.comment_id));

    repliesReady = allWithReplies.filter((item: any) =>
      !repliedCommentIds.has(item.comment_id) &&
      !item.comment_id.includes('.')
    );
  }

  console.log(`\n✅ Replies ready to send (after filtering):`);
  console.log(`  Total: ${repliesReady.length}`);
  repliesReady.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.comment_id}`);
  });
}

checkReplies().catch(console.error);
