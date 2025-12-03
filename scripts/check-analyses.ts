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

async function checkAnalyses() {
  const email = 'logangibbons1999@gmail.com';

  // Get user ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('email', email)
    .single();

  if (!profile) {
    console.log('User not found');
    return;
  }

  const userId = profile.id;
  console.log(`User ID: ${userId}`);
  console.log(`Account created: ${profile.created_at}\n`);

  // Get video analyses
  const { data: analyses } = await supabase
    .from('video_analyses')
    .select('video_id, raw, analyzed_at')
    .eq('user_id', userId)
    .order('analyzed_at', { ascending: false });

  console.log(`📊 Video analyses for this account:`);
  console.log(`  Total: ${analyses?.length || 0}\n`);

  if (analyses && analyses.length > 0) {
    analyses.slice(0, 10).forEach((item: any, i: number) => {
      const totalComments = (item.raw as any)?.totalComments || 0;
      const analyzedDate = new Date(item.analyzed_at).toLocaleString();
      console.log(`${i + 1}. Video: ${item.video_id}`);
      console.log(`   Comments: ${totalComments}`);
      console.log(`   Analyzed: ${analyzedDate}`);
      console.log('');
    });
  }

  // Get user videos
  const { data: videos } = await supabase
    .from('user_videos')
    .select('video_id, title')
    .eq('user_id', userId);

  console.log(`\n📹 User videos in database:`);
  console.log(`  Total: ${videos?.length || 0}\n`);

  if (videos && videos.length > 0) {
    videos.slice(0, 10).forEach((item, i) => {
      console.log(`${i + 1}. ${item.video_id}: ${item.title}`);
    });
  }
}

checkAnalyses().catch(console.error);
