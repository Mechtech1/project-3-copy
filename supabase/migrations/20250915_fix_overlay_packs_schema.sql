/*
  # Fix overlay_packs table schema
  
  Ensures all required columns exist in overlay_packs table to fix schema cache errors.
  This migration is idempotent and will only add missing columns.
*/

-- Ensure overlay_packs table exists with all required columns
CREATE TABLE IF NOT EXISTS overlay_packs (
  id TEXT PRIMARY KEY,
  vehicle_family TEXT,
  workspace_type TEXT,
  workspace_svg TEXT,
  baseline_dimensions JSONB,
  parts JSONB,
  access_paths JSONB,
  layers JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  gpt_model TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add generated_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN generated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added generated_at column to overlay_packs';
  END IF;

  -- Add baseline_dimensions column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'baseline_dimensions'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN baseline_dimensions JSONB;
    RAISE NOTICE 'Added baseline_dimensions column to overlay_packs';
  END IF;

  -- Add image_url column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN image_url TEXT;
    RAISE NOTICE 'Added image_url column to overlay_packs';
  END IF;

  -- Ensure other required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'vehicle_family'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN vehicle_family TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'workspace_type'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN workspace_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'workspace_svg'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN workspace_svg TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'parts'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN parts JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'gpt_model'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN gpt_model TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN usage_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_overlay_packs_vehicle_family ON overlay_packs(vehicle_family);
CREATE INDEX IF NOT EXISTS idx_overlay_packs_workspace_type ON overlay_packs(workspace_type);
CREATE INDEX IF NOT EXISTS idx_overlay_packs_family_workspace ON overlay_packs(vehicle_family, workspace_type);
CREATE INDEX IF NOT EXISTS idx_overlay_packs_usage_count ON overlay_packs(usage_count DESC);

-- Enable RLS if not already enabled
ALTER TABLE overlay_packs ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
  -- Allow authenticated read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'overlay_packs' AND policyname = 'Allow authenticated read access'
  ) THEN
    CREATE POLICY "Allow authenticated read access" ON overlay_packs FOR SELECT TO authenticated USING (true);
  END IF;

  -- Allow service role full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'overlay_packs' AND policyname = 'Allow service role full access'
  ) THEN
    CREATE POLICY "Allow service role full access" ON overlay_packs FOR ALL TO service_role USING (true);
  END IF;

  -- Allow public users to read overlay packs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'overlay_packs' AND policyname = 'Allow public users to read overlay packs'
  ) THEN
    CREATE POLICY "Allow public users to read overlay packs" ON overlay_packs FOR SELECT TO public USING (true);
  END IF;

  -- Allow public users to insert overlay packs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'overlay_packs' AND policyname = 'Allow public users to insert overlay packs'
  ) THEN
    CREATE POLICY "Allow public users to insert overlay packs" ON overlay_packs FOR INSERT TO public WITH CHECK (true);
  END IF;

  -- Allow public users to update overlay packs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'overlay_packs' AND policyname = 'Allow public users to update overlay packs'
  ) THEN
    CREATE POLICY "Allow public users to update overlay packs" ON overlay_packs FOR UPDATE TO public USING (true) WITH CHECK (true);
  END IF;
END $$;
