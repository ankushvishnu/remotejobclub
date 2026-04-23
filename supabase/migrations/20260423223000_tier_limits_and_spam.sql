-- Track openrouter token usage and quotas in profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS cycle_resume_reviews INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cycle_job_views INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS openrouter_token_count INT DEFAULT 0;

-- Table to track job clicks / views
CREATE TABLE IF NOT EXISTS job_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_clicks_job_id ON job_clicks(job_id);
CREATE INDEX IF NOT EXISTS idx_job_clicks_created_at ON job_clicks(created_at);

-- View for healthy jobs (filters out jobs with > 15 clicks in the last 7 days)
CREATE OR REPLACE VIEW vw_healthy_jobs AS
SELECT jp.*
FROM job_postings jp
LEFT JOIN job_clicks jc ON jp.id = jc.job_id AND jc.created_at >= NOW() - INTERVAL '7 days'
WHERE jp.status = 'ACTIVE'
GROUP BY jp.id
HAVING COUNT(jc.id) <= 15;

-- RPC to record a job view and check quotas
CREATE OR REPLACE FUNCTION record_job_view(p_job_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_tier TEXT;
  v_views INT;
  v_cycle_start TIMESTAMPTZ;
  v_limit INT;
  v_url TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Require login to apply
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in to apply for jobs. Join the Remote Job Club today!');
  END IF;

  -- Get user profile
  SELECT subscription_tier, cycle_job_views, current_cycle_start INTO v_tier, v_views, v_cycle_start 
  FROM profiles WHERE id = v_user_id;

  -- Lazy Auto-Downgrade Check
  IF v_tier IN ('pro', 'elite') AND v_cycle_start < NOW() - INTERVAL '30 days' THEN
    -- Downgrade to free
    v_tier := 'free';
    v_views := 0;
    UPDATE profiles 
    SET subscription_tier = 'free', 
        cycle_job_views = 0, 
        cycle_resume_reviews = 0, 
        current_cycle_start = NOW() 
    WHERE id = v_user_id;
  END IF;

  -- Determine limits
  IF v_tier = 'elite' THEN v_limit := 75;
  ELSIF v_tier = 'pro' THEN v_limit := 45;
  ELSE v_limit := 15; -- Free
  END IF;

  -- Check Quota
  IF v_views >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have reached your ' || UPPER(v_tier) || ' tier view limit of ' || v_limit || ' jobs per cycle. Please upgrade your tier or wait for the next cycle.');
  END IF;

  -- Get job URL
  SELECT url INTO v_url FROM job_postings WHERE id = p_job_id;
  IF v_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Job not found.');
  END IF;

  -- Record click
  INSERT INTO job_clicks (job_id, user_id) VALUES (p_job_id, v_user_id);
  
  -- Increment user view count
  UPDATE profiles SET cycle_job_views = cycle_job_views + 1 WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'url', v_url);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
