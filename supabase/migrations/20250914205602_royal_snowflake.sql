/*
  # Fix gpt_repair_cache RLS policies for caching

  1. Security Updates
    - Add policy for authenticated users to insert repair cache
    - Add policy for authenticated users to update repair cache
    - Add policy for authenticated users to read repair cache
    - Add policy for public users for unauthenticated access

  2. Cache Management
    - Allow client-side caching of generated repair steps
    - Enable upsert operations for repair cache updates
*/

-- Enable RLS on gpt_repair_cache table
ALTER TABLE gpt_repair_cache ENABLE ROW LEVEL SECURITY;

-- Add policy for authenticated users to read repair cache
CREATE POLICY "Allow authenticated users to read repair cache"
  ON gpt_repair_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Add policy for authenticated users to insert repair cache
CREATE POLICY "Allow authenticated users to insert repair cache"
  ON gpt_repair_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add policy for authenticated users to update repair cache
CREATE POLICY "Allow authenticated users to update repair cache"
  ON gpt_repair_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add policy for public users to read repair cache (for unauthenticated access)
CREATE POLICY "Allow public users to read repair cache"
  ON gpt_repair_cache
  FOR SELECT
  TO public
  USING (true);

-- Add policy for public users to insert repair cache (for unauthenticated access)
CREATE POLICY "Allow public users to insert repair cache"
  ON gpt_repair_cache
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Add policy for public users to update repair cache (for unauthenticated access)
CREATE POLICY "Allow public users to update repair cache"
  ON gpt_repair_cache
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);