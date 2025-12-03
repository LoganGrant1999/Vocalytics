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

async function checkHighPriority() {
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

  // Query all high-priority comments (priority >= 40)
  const { data: allHighPriority } = await supabase
    .from('comment_scores')
    .select('comment_id, priority_score, comment_text, dismissed, suggested_reply')
    .eq('user_id', userId)
    .gte('priority_score', 40)
    .or('dismissed.is.null,dismissed.eq.false');

  console.log(`📊 All high-priority comments (score >= 40, not dismissed):`);
  console.log(`  Total: ${allHighPriority?.length || 0}\n`);

  allHighPriority?.forEach((item, i) => {
    const isReply = item.comment_id.includes('.');
    console.log(`${i + 1}. ${item.comment_id}`);
    console.log(`   Score: ${item.priority_score}`);
    console.log(`   Text: ${item.comment_text?.substring(0, 50)}...`);
    console.log(`   Is Reply: ${isReply ? 'YES (will be filtered)' : 'NO'}`);
    console.log(`   Dismissed: ${item.dismissed}`);
    console.log(`   Has suggested_reply: ${item.suggested_reply ? 'YES' : 'NO'}`);
    console.log('');
  });

  // Check posted_replies table
  const { data: postedReplies } = await supabase
    .from('posted_replies')
    .select('comment_id')
    .eq('user_id', userId);

  console.log(`📮 Posted replies:`);
  console.log(`  Total: ${postedReplies?.length || 0}\n`);

  if (postedReplies && postedReplies.length > 0) {
    postedReplies.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.comment_id}`);
    });
    console.log('');
  }

  // Apply the same filtering logic as the inbox endpoint
  const repliedCommentIds = new Set((postedReplies || []).map((r: any) => r.comment_id));

  const filtered = allHighPriority?.filter((item: any) =>
    !repliedCommentIds.has(item.comment_id) &&
    !item.comment_id.includes('.')
  );

  console.log(`✅ After filtering (same logic as inbox endpoint):`);
  console.log(`  Total: ${filtered?.length || 0}\n`);

  filtered?.forEach((item, i) => {
    console.log(`${i + 1}. ${item.comment_id}`);
    console.log(`   Score: ${item.priority_score}`);
    console.log(`   Text: ${item.comment_text?.substring(0, 50)}...`);
    console.log('');
  });
}

checkHighPriority().catch(console.error);
