-- Reset usage counts for testing
UPDATE profiles 
SET 
  comments_analyzed_count = 0,
  replies_generated_count = 0,
  reset_date = NOW()
WHERE google_id IS NOT NULL;
