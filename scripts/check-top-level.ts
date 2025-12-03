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

async function checkTopLevel() {
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

  // Query ALL comment_scores
  const { data: allComments } = await supabase
    .from('comment_scores')
    .select('comment_id, priority_score, comment_text, dismissed, suggested_reply')
    .eq('user_id', userId)
    .order('priority_score', { ascending: false });

  console.log(`📊 ALL comment_scores for user:`);
  console.log(`  Total: ${allComments?.length || 0}\n`);

  // Separate top-level from replies
  const topLevel = allComments?.filter(c => !c.comment_id.includes('.'));
  const replies = allComments?.filter(c => c.comment_id.includes('.'));

  console.log(`📝 Top-level comments (no dot in ID):`);
  console.log(`  Total: ${topLevel?.length || 0}\n`);

  topLevel?.forEach((item, i) => {
    console.log(`${i + 1}. ${item.comment_id}`);
    console.log(`   Score: ${item.priority_score}`);
    console.log(`   Text: ${item.comment_text?.substring(0, 60)}...`);
    console.log(`   Dismissed: ${item.dismissed}`);
    console.log(`   Has suggested_reply: ${item.suggested_reply ? 'YES' : 'NO'}`);
    console.log('');
  });

  console.log(`💬 Reply comments (has dot in ID):`);
  console.log(`  Total: ${replies?.length || 0}\n`);

  // Check posted_replies table
  const { data: postedReplies } = await supabase
    .from('posted_replies')
    .select('comment_id, posted_at')
    .eq('user_id', userId);

  console.log(`📮 Posted replies (should filter these out):`);
  console.log(`  Total: ${postedReplies?.length || 0}\n`);

  if (postedReplies && postedReplies.length > 0) {
    postedReplies.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.comment_id} (posted: ${item.posted_at})`);
    });
    console.log('');
  }

  // Apply filtering for high-priority inbox
  const repliedCommentIds = new Set((postedReplies || []).map((r: any) => r.comment_id));

  const highPriorityFiltered = topLevel?.filter((item: any) =>
    item.priority_score >= 40 &&
    (item.dismissed === false || item.dismissed === null) &&
    !repliedCommentIds.has(item.comment_id)
  );

  console.log(`✅ Top-level high-priority after ALL filters (score>=40, not dismissed, not replied):`);
  console.log(`  Total: ${highPriorityFiltered?.length || 0}\n`);

  highPriorityFiltered?.forEach((item, i) => {
    console.log(`${i + 1}. ${item.comment_id}`);
    console.log(`   Score: ${item.priority_score}`);
    console.log(`   Text: ${item.comment_text?.substring(0, 60)}...`);
    console.log('');
  });
}

checkTopLevel().catch(console.error);
