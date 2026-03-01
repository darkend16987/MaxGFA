-- ============================================================
-- GFA Optimizer — Supabase Database Schema
-- Run this SQL in your Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Projects table: stores all user projects
CREATE TABLE projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'Dự án mới',
  description text DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: users can only access their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Index for faster queries
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);

-- 5. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SETUP INSTRUCTIONS:
--
-- 1. Run this SQL in Supabase Dashboard > SQL Editor
-- 2. Go to Authentication > Settings > disable "Allow new users to sign up"
--    (this ensures only admin-created accounts can log in)
-- 3. Go to Authentication > Users > "Create new user" to add users
--    (use their Gmail address + a password)
-- 4. Copy your project URL and anon key from Settings > API
--    into frontend/.env.local
-- ============================================================
