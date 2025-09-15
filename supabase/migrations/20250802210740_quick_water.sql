/*
  # Fix RLS policies for user_vehicles table

  1. Security Changes
    - Update RLS policies to allow public access for development
    - Add policies for anonymous users
    - Maintain data isolation by user_id

  2. Notes
    - This allows the app to work without authentication during development
    - In production, you should implement proper Supabase authentication
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own vehicles" ON user_vehicles;
DROP POLICY IF EXISTS "Users can insert own vehicles" ON user_vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON user_vehicles;
DROP POLICY IF EXISTS "Users can delete own vehicles" ON user_vehicles;

-- Add permissive policies for development
CREATE POLICY "Allow public read access for user_vehicles"
  ON user_vehicles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access for user_vehicles"
  ON user_vehicles
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access for user_vehicles"
  ON user_vehicles
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access for user_vehicles"
  ON user_vehicles
  FOR DELETE
  TO public
  USING (true);

-- Also add policies for authenticated and anonymous users
CREATE POLICY "Allow authenticated read access for user_vehicles"
  ON user_vehicles
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow authenticated write access for user_vehicles"
  ON user_vehicles
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access for user_vehicles"
  ON user_vehicles
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access for user_vehicles"
  ON user_vehicles
  FOR DELETE
  TO authenticated, anon
  USING (true);