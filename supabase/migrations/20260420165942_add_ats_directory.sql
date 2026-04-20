-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create company directory table
CREATE TABLE company_directory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    careers_url TEXT,
    ats_provider TEXT NOT NULL, -- e.g., greenhouse, lever, ashby, custom
    board_token TEXT, -- e.g., 'canonical' for greenhouse, 'hubspot' for custom, etc.
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEPRECATED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for company_directory
ALTER TABLE company_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to company_directory" ON company_directory FOR SELECT USING (true);
CREATE POLICY "Allow service role full access to company_directory" ON company_directory FOR ALL USING (auth.role() = 'service_role');

-- Add new columns to job_postings for the Home Page filters
ALTER TABLE job_postings 
  ADD COLUMN IF NOT EXISTS work_arrangement TEXT DEFAULT 'Remote',
  ADD COLUMN IF NOT EXISTS tech_stack JSONB DEFAULT '[]'::jsonb;

-- Seed initial companies specified by user
INSERT INTO company_directory (company_name, ats_provider, board_token) VALUES
  ('Zapier', 'ashby', 'zapier'),
  ('Canonical', 'greenhouse', 'canonical'),
  ('DuckDuckGo', 'ashby', 'duckduckgo'),
  ('Buffer', 'custom', 'buffer'),
  ('HubSpot', 'custom', 'hubspot'),
  ('Salesforce', 'workday', 'salesforce'),
  ('LearningWithAI', 'custom', 'learningwithai');
