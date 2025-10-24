-- Fix analyze quota function after comments_analyzed_count column was dropped
-- Analysis is now unlimited for all tiers (no quota tracking)

-- Drop the old function that references the non-existent column
DROP FUNCTION IF EXISTS public.consume_analyze_quota(uuid, integer);

-- Create a new function that always allows (unlimited analysis)
CREATE OR REPLACE FUNCTION public.consume_analyze_quota(
  _user_id uuid,
  _cap integer
)
RETURNS TABLE (
  allowed boolean,
  new_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Analysis is unlimited, always return allowed=true
  -- We don't track analysis count anymore
  RETURN QUERY SELECT true as allowed, 0 as new_count;
END;
$$;

-- Update the reply quota function to use the renamed column
DROP FUNCTION IF EXISTS public.consume_reply_quota(uuid, integer);

CREATE OR REPLACE FUNCTION public.consume_reply_quota(
  _user_id uuid,
  _cap integer
)
RETURNS TABLE (
  allowed boolean,
  new_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Get current reply count
  SELECT replies_weekly_count INTO current_count
  FROM public.profiles
  WHERE id = _user_id;

  -- Check if under cap
  IF current_count < _cap THEN
    -- Increment and return new count
    UPDATE public.profiles
    SET replies_weekly_count = replies_weekly_count + 1
    WHERE id = _user_id
    RETURNING replies_weekly_count INTO current_count;

    RETURN QUERY SELECT true as allowed, current_count as new_count;
  ELSE
    -- Over cap, return not allowed
    RETURN QUERY SELECT false as allowed, current_count as new_count;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.consume_analyze_quota IS 'Always returns allowed=true (unlimited analysis for all tiers)';
COMMENT ON FUNCTION public.consume_reply_quota IS 'Atomic reply quota consumption using replies_weekly_count';
