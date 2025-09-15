/*
  # Fix overlay packs RLS policies for caching

  1. Security Updates
    - Add policy for authenticated users to insert overlay packs
    - Add policy for authenticated users to update overlay packs
    - Keep existing read policy for authenticated users
    - Keep service role policy for full management

  2. Cache Management
    - Allow client-side caching of generated overlay packs
    - Enable upsert operations for overlay pack updates
*/

-- Add policy for authenticated users to insert overlay packs
CREATE POLICY "Allow authenticated users to insert overlay packs"
  ON overlay_packs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add policy for authenticated users to update overlay packs
CREATE POLICY "Allow authenticated users to update overlay packs"
  ON overlay_packs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add policy for public users to insert overlay packs (for unauthenticated access)
CREATE POLICY "Allow public users to insert overlay packs"
  ON overlay_packs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Add policy for public users to update overlay packs (for unauthenticated access)
CREATE POLICY "Allow public users to update overlay packs"
  ON overlay_packs
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Add policy for public users to read overlay packs (for unauthenticated access)
CREATE POLICY "Allow public users to read overlay packs"
  ON overlay_packs
  FOR SELECT
  TO public
  USING (true);