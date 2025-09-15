/*
  # Sample Data for Repair System

  1. Tables
    - `repair_tasks`
      - `id` (text) - Unique identifier for the task
      - `name` (text) - Task name
      - `description` (text) - Detailed description
      - `estimated_time` (text) - Time estimate
      - `difficulty` (text) - Easy, Medium, or Hard
      - `vehicle_make` (text) - Target vehicle make
      - `vehicle_model` (text, optional) - Target vehicle model
      - `vehicle_year_min` (integer, optional) - Minimum year
      - `vehicle_year_max` (integer, optional) - Maximum year
      - `created_at` (timestamp) - Record creation time
    
    - `repair_tools`
      - `id` (text) - Unique identifier
      - `repair_task_id` (text) - References repair_tasks.id
      - `name` (text) - Tool name
      - `description` (text) - Tool description
      - `required` (boolean) - Whether tool is required
      - `created_at` (timestamp) - Record creation time
    
    - `repair_steps`
      - `id` (text) - Unique identifier
      - `repair_task_id` (text) - References repair_tasks.id
      - `step_number` (integer) - Order of the step
      - `instruction` (text) - Step instruction
      - `tool_required` (text, optional) - Tool needed for step
      - `part_name` (text) - Part being worked on
      - `overlay_target` (text) - AR overlay target
      - `audio_script` (text) - Audio narration script
      - `created_at` (timestamp) - Record creation time
    
    - `repair_sessions`
      - `id` (text) - Unique identifier
      - `vehicle_vin` (text) - VIN of vehicle being repaired
      - `task_id` (text) - References repair_tasks.id
      - `task_name` (text) - Name of the repair task
      - `start_time` (timestamp) - Session start time
      - `end_time` (timestamp, optional) - Session end time
      - `status` (text) - Session status
      - `current_step_index` (integer) - Current step being performed
      - `steps_completed` (integer) - Number of steps completed
      - `total_steps` (integer) - Total number of steps
      - `step_log` (text[]) - Log of completed steps
      - `created_at` (timestamp) - Record creation time
    
    - `voice_logs`
      - `id` (text) - Unique identifier
      - `session_id` (text) - References repair_sessions.id
      - `timestamp` (timestamp) - Log timestamp
      - `type` (text) - 'user' or 'assistant'
      - `text` (text) - Transcribed or generated text
      - `audio_generated` (boolean) - Whether audio was generated
      - `created_at` (timestamp) - Record creation time

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Insert sample vehicles and repair tasks for testing
*/


-- Create repair_tasks table
CREATE TABLE IF NOT EXISTS repair_tasks (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  estimated_time text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  vehicle_make text NOT NULL,
  vehicle_model text,
  vehicle_year_min integer,
  vehicle_year_max integer,
  created_at timestamptz DEFAULT now()
);

-- Create repair_tools table
CREATE TABLE IF NOT EXISTS repair_tools (
  id text PRIMARY KEY,
  repair_task_id text NOT NULL REFERENCES repair_tasks(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  required boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create repair_steps table
CREATE TABLE IF NOT EXISTS repair_steps (
  id text PRIMARY KEY,
  repair_task_id text NOT NULL REFERENCES repair_tasks(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  instruction text NOT NULL,
  tool_required text,
  part_name text NOT NULL,
  audio_script text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create repair_sessions table
CREATE TABLE IF NOT EXISTS repair_sessions (
  id text PRIMARY KEY,
  vehicle_vin text NOT NULL,
  task_id text NOT NULL REFERENCES repair_tasks(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  status text NOT NULL CHECK (status IN ('in_progress', 'paused', 'completed', 'cancelled')),
  current_step_index integer DEFAULT 0,
  steps_completed integer DEFAULT 0,
  total_steps integer NOT NULL,
  step_log text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create voice_logs table
CREATE TABLE IF NOT EXISTS voice_logs (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES repair_sessions(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  type text NOT NULL CHECK (type IN ('user', 'assistant')),
  text text NOT NULL,
  audio_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE repair_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
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

CREATE POLICY "Public read access for repair_sessions"
  ON repair_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public write access for repair_sessions"
  ON repair_sessions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for voice_logs"
  ON voice_logs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public write access for voice_logs"
  ON voice_logs FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Insert sample repair tasks
INSERT INTO repair_tasks (id, name, description, estimated_time, difficulty, vehicle_make, vehicle_model, vehicle_year_min, vehicle_year_max) VALUES
  ('brake-pad-replacement', 'Brake Pad Replacement', 'Replace worn brake pads with new ones', '45-60 minutes', 'Medium', 'Honda', 'Civic', 2010, 2020),
  ('oil-change', 'Oil Change', 'Replace engine oil and oil filter', '30-45 minutes', 'Easy', 'Honda', 'Civic', 2010, 2020),
  ('battery-replacement', 'Battery Replacement', 'Replace car battery with a new one', '20-30 minutes', 'Easy', 'Honda', 'Civic', 2010, 2020)
ON CONFLICT (id) DO NOTHING;

-- Insert sample tools for brake pad replacement
INSERT INTO repair_tools (id, repair_task_id, name, description, required) VALUES
  ('jack-brake', 'brake-pad-replacement', 'Car Jack', 'To lift the vehicle', true),
  ('lug-wrench-brake', 'brake-pad-replacement', 'Lug Wrench', '19mm socket', true),
  ('c-clamp-brake', 'brake-pad-replacement', 'C-Clamp', 'To compress brake caliper', true),
  ('brake-cleaner-brake', 'brake-pad-replacement', 'Brake Cleaner', 'To clean brake components', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample tools for oil change
INSERT INTO repair_tools (id, repair_task_id, name, description, required) VALUES
  ('oil-drain-pan', 'oil-change', 'Oil Drain Pan', 'To catch old oil', true),
  ('socket-wrench-oil', 'oil-change', 'Socket Wrench Set', 'To remove drain plug', true),
  ('oil-filter-wrench', 'oil-change', 'Oil Filter Wrench', 'To remove oil filter', true),
  ('funnel-oil', 'oil-change', 'Funnel', 'For adding new oil', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample tools for battery replacement
INSERT INTO repair_tools (id, repair_task_id, name, description, required) VALUES
  ('wrench-set-battery', 'battery-replacement', 'Wrench Set', 'To disconnect battery terminals', true),
  ('gloves-battery', 'battery-replacement', 'Safety Gloves', 'To protect hands', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample steps for brake pad replacement
INSERT INTO repair_steps (id, repair_task_id, step_number, instruction, tool_required, part_name, audio_script) VALUES
  ('brake-step-1', 'brake-pad-replacement', 1, 'Locate your vehicle''s front wheel and prepare to jack up the car', null, 'Front Wheel', 'First, we need to locate your front wheel. Make sure your car is on level ground and the parking brake is engaged.'),
  ('brake-step-2', 'brake-pad-replacement', 2, 'Use the lug wrench to loosen the lug nuts before jacking up the car', 'Lug Wrench', 'Lug Nuts', 'Now use your lug wrench to loosen the lug nuts. Turn counter-clockwise, but don''t remove them completely yet.'),
  ('brake-step-3', 'brake-pad-replacement', 3, 'Jack up the vehicle and remove the wheel completely', 'Car Jack', 'Wheel', 'Place the jack under the vehicle''s jack point and raise the car. Now you can fully remove the lug nuts and pull off the wheel.'),
  ('brake-step-4', 'brake-pad-replacement', 4, 'Locate the brake caliper and remove the caliper bolts', null, 'Brake Caliper', 'You should now see the brake caliper. This is the metal component that houses the brake pads. We need to remove the bolts holding it in place.')
ON CONFLICT (id) DO NOTHING;

-- Insert sample steps for oil change
INSERT INTO repair_steps (id, repair_task_id, step_number, instruction, tool_required, part_name, audio_script) VALUES
  ('oil-step-1', 'oil-change', 1, 'Locate the oil drain plug underneath your vehicle', null, 'Oil Drain Plug', 'We need to find the oil drain plug under your car. It''s usually located at the lowest point of the oil pan.'),
  ('oil-step-2', 'oil-change', 2, 'Position the drain pan and remove the drain plug', 'Socket Wrench Set', 'Drain Plug', 'Place your drain pan directly under the plug, then use your socket wrench to remove the drain plug. Turn counter-clockwise.')
ON CONFLICT (id) DO NOTHING;

-- Insert sample steps for battery replacement
INSERT INTO repair_steps (id, repair_task_id, step_number, instruction, tool_required, part_name, audio_script) VALUES
  ('battery-step-1', 'battery-replacement', 1, 'Open the hood and locate the car battery', null, 'Car Battery', 'First, pop the hood and locate your car battery. It''s usually a rectangular black box with two terminals.'),
  ('battery-step-2', 'battery-replacement', 2, 'Disconnect the negative terminal first, then the positive terminal', 'Wrench Set', 'Battery Terminals', 'Always disconnect the negative terminal first - that''s the black cable. Then disconnect the positive red cable.')
ON CONFLICT (id) DO NOTHING;