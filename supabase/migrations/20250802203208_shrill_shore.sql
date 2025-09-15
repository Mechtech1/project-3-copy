/*
  # Create user_vehicles table for vehicle profile management

  1. New Tables
    - `user_vehicles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `vin` (text, unique per user)
      - `make` (text)
      - `model` (text)
      - `year` (integer)
      - `engine_type` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `user_vehicles` table
    - Add policy for authenticated users to manage their own vehicles
    - Add unique constraint on user_id + vin combination

  3. Indexes
    - Index on user_id for fast vehicle lookups
    - Index on vin for duplicate checking
*/

CREATE TABLE IF NOT EXISTS user_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vin text NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  engine_type text DEFAULT 'Unknown',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, vin)
);

-- Enable RLS
ALTER TABLE user_vehicles ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can read own vehicles"
  ON user_vehicles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles"
  ON user_vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles"
  ON user_vehicles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles"
  ON user_vehicles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_id ON user_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_vin ON user_vehicles(vin);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_created_at ON user_vehicles(created_at DESC);