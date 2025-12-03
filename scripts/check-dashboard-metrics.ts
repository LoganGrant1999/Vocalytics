import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetrics() {
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
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`\n📊 Dashboard Metrics for ${email}`);
  console.log(`User ID: ${userId}\n`);

  // 1. New Comments (24h)
  const { data: newCommentsData } = await supabase
    .from('comment_scores')
    .select('comment_id, published_at')
    .eq('user_id', userId)
    .gte('published_at', yesterday.toISOString());

  const newComments24h = (newCommentsData || []).filter(
    (item: any) => !item.comment_id.includes('.')
  );

  console.log(`1️⃣  NEW COMMENTS (24h): ${newComments24h.length}`);
  console.log(`   Total rows (including replies): ${newCommentsData?.length || 0}`);
  console.log(`   Top-level only: ${newComments24h.length}`);
  newComments24h.forEach((c: any) => {
    console.log(`     - ${c.comment_id} (published: ${c.published_at})`);
  });

  // 2. High-Priority To Reply
  const { data: highPriorityData } = await supabase
    .from('comment_scores')
    .select('video_id, comment_id, priority_score, dismissed')
    .eq('user_id', userId)
    .gte('priority_score', 40)
    .or('dismissed.is.null,dismissed.eq.false');

  const { data: postedReplies } = await supabase
    .from('posted_replies')
    .select('comment_id')
    .eq('user_id', userId);

  const repliedCommentIds = new Set((postedReplies || []).map((r: any) => r.comment_id));

  const filteredHighPriority = (highPriorityData || []).filter((item: any) =>
    !repliedCommentIds.has(item.comment_id) &&
    !item.comment_id.includes('.')
  );

  console.log(`\n2️⃣  HIGH-PRIORITY TO REPLY: ${filteredHighPriority.length}`);
  console.log(`   Total high-priority (≥40): ${highPriorityData?.length || 0}`);
  console.log(`   After filtering replied & replies: ${filteredHighPriority.length}`);
  filteredHighPriority.forEach((c: any) => {
    console.log(`     - ${c.comment_id} (score: ${c.priority_score}, video: ${c.video_id})`);
  });

  // 3. Replies Ready To Send
  const { data: repliesReadyData } = await supabase
    .from('comment_scores')
    .select('comment_id, suggested_reply')
    .eq('user_id', userId)
    .not('suggested_reply', 'is', null)
    .or('dismissed.is.null,dismissed.eq.false');

  const repliesReady = (repliesReadyData || []).filter((item: any) =>
    !repliedCommentIds.has(item.comment_id) &&
    !item.comment_id.includes('.')
  );

  console.log(`\n3️⃣  REPLIES READY TO SEND: ${repliesReady.length}`);
  console.log(`   Total with suggested_reply: ${repliesReadyData?.length || 0}`);
  console.log(`   After filtering replied & replies: ${repliesReady.length}`);
  repliesReady.forEach((c: any) => {
    console.log(`     - ${c.comment_id}`);
  });

  // 4. Time Saved Today
  const { data: repliesPostedToday } = await supabase
    .from('posted_replies')
    .select('comment_id, posted_at')
    .eq('user_id', userId)
    .gte('posted_at', today.toISOString());

  const timeSavedMinutes = (repliesPostedToday?.length || 0) * 3;

  console.log(`\n4️⃣  TIME SAVED TODAY: ${timeSavedMinutes} min`);
  console.log(`   Replies posted today: ${repliesPostedToday?.length || 0}`);
  repliesPostedToday?.forEach((r: any) => {
    console.log(`     - ${r.comment_id} (posted: ${r.posted_at})`);
  });

  // 5. Comment change % vs last video
  const { data: recentAnalyses } = await supabase
    .from('video_analyses')
    .select('video_id, raw, analyzed_at')
    .eq('user_id', userId)
    .order('analyzed_at', { ascending: false })
    .limit(2);

  console.log(`\n5️⃣  COMMENT CHANGE % VS LAST VIDEO`);
  console.log(`   Video analyses found: ${recentAnalyses?.length || 0}`);

  if (recentAnalyses && recentAnalyses.length >= 2) {
    const latestCount = (recentAnalyses[0].raw as any)?.totalComments || 0;
    const previousCount = (recentAnalyses[1].raw as any)?.totalComments || 0;
    const changePercent = previousCount > 0
      ? Math.round(((latestCount - previousCount) / previousCount) * 100)
      : 0;

    console.log(`   Latest video (${recentAnalyses[0].video_id}): ${latestCount} comments`);
    console.log(`   Previous video (${recentAnalyses[1].video_id}): ${previousCount} comments`);
    console.log(`   Change: ${changePercent > 0 ? '+' : ''}${changePercent}%`);
  } else if (recentAnalyses && recentAnalyses.length === 1) {
    console.log(`   Only 1 analysis found (${recentAnalyses[0].video_id})`);
    console.log(`   Change %: 0% (need at least 2 videos)`);
  } else {
    console.log(`   No analyses found`);
  }

  // 6. All posted replies
  console.log(`\n6️⃣  ALL POSTED REPLIES (${postedReplies?.length || 0} total)`);
  postedReplies?.forEach((r: any, i: number) => {
    console.log(`   ${i + 1}. ${r.comment_id}`);
  });
}

checkMetrics().catch(console.error);
