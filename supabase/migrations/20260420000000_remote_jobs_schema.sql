-- Core schema for The Vault
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL,          -- e.g., 'stripe.com'
  job_source_id TEXT,                    -- ID from original ATS
  semantic_hash TEXT NOT NULL UNIQUE,    -- SHA-256(title + normalized_domain)
  title TEXT NOT NULL,
  description TEXT,
  match_score NUMERIC(3,1),             -- 1-10 curation grade
  curation_notes TEXT,                   -- AI-generated reasoning
  status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (status IN ('ACTIVE', 'UNVERIFIED', 'EXPIRED')),
  url TEXT,                              -- Hosted URL from ATS
  ats_source TEXT,                       -- 'lever', 'greenhouse', 'ashby', 'openrouter'
  location TEXT,
  salary_range TEXT,
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic tracking for metric dashboarding
CREATE TABLE IF NOT EXISTS job_source_metrics (
  company_domain TEXT PRIMARY KEY,
  last_ingested TIMESTAMPTZ,
  active_job_count INT DEFAULT 0
);

-- User profiles linked to Supabase Auth
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  credits INTEGER DEFAULT 0,            -- Number of remaining lead views
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which leads a user has purchased/viewed
CREATE TABLE user_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  match_score NUMERIC(3,1),
  curation_notes TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Payment transactions
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  provider TEXT NOT NULL,               -- 'stub' for MVP
  provider_payment_id TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  credits_granted INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_semantic_hash ON job_postings(semantic_hash);
CREATE INDEX idx_jobs_status ON job_postings(status);
CREATE INDEX idx_jobs_company ON job_postings(company_domain);
CREATE INDEX idx_user_leads_user ON user_leads(user_id);
CREATE INDEX idx_payments_user ON payments(user_id);

-- Enable RLS on ALL tables
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- job_postings: public read for ACTIVE jobs only
CREATE POLICY "Anyone can view active jobs" ON job_postings
  FOR SELECT USING (status = 'ACTIVE');

-- profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- user_leads: users can only see their own leads
CREATE POLICY "Users can view own leads" ON user_leads
  FOR SELECT USING (auth.uid() = user_id);

-- payments: users can only see their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);


-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
