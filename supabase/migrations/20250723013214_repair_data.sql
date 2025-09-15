
-- Create repair_tasks table with sample data
CREATE TABLE IF NOT EXISTS repair_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_time TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT,
  vehicle_year_min INTEGER,
  vehicle_year_max INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create repair_tools table
CREATE TABLE IF NOT EXISTS repair_tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_task_id UUID REFERENCES repair_tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create repair_steps table
CREATE TABLE IF NOT EXISTS repair_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_task_id UUID REFERENCES repair_tasks(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  tool_required TEXT,
  part_name TEXT NOT NULL,
  overlay_target TEXT NOT NULL,
  audio_script TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create repair_sessions table
CREATE TABLE IF NOT EXISTS repair_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_vin TEXT NOT NULL,
  task_id UUID REFERENCES repair_tasks(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'paused', 'completed', 'cancelled')),
  current_step_index INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  step_log TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create voice_logs table
CREATE TABLE IF NOT EXISTS voice_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES repair_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('user', 'assistant')),
  text TEXT NOT NULL,
  audio_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- Enable Row Level Security
ALTER TABLE repair_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Public read access for repair_tasks"
  ON repair_tasks FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read access for repair_tools"
  ON repair_tools FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public read access for repair_steps"
  ON repair_steps FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public write access for repair_sessions"
  ON repair_sessions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public write access for voice_logs"
  ON voice_logs FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Insert sample repair tasks
INSERT INTO repair_tasks (name, description, estimated_time, difficulty, vehicle_make, vehicle_model, vehicle_year_min, vehicle_year_max) VALUES
('Brake Pad Replacement', 'Replace worn brake pads with new ones', '45-60 minutes', 'Medium', 'Honda', 'Civic', 2010, 2020),
('Oil Change', 'Change engine oil and oil filter', '30-45 minutes', 'Easy', 'Honda', 'Civic', 2010, 2020),
('Air Filter Replacement', 'Replace dirty air filter with new one', '15-20 minutes', 'Easy', 'Honda', 'Civic', 2010, 2020),
('Spark Plug Replacement', 'Replace old spark plugs', '60-90 minutes', 'Medium', 'Honda', 'Civic', 2010, 2020),
('Battery Replacement', 'Replace dead car battery', '20-30 minutes', 'Easy', 'Honda', 'Civic', 2010, 2020)
ON CONFLICT (id) DO NOTHING; 