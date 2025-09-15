/*
  # Add missing columns to overlay_packs table

  1. New Columns
    - `baseline_dimensions` (jsonb) - Stores width/height dimensions for overlay scaling
    - Make `task_id` nullable in repair_sessions for AI-generated tasks

  2. Changes
    - Add baseline_dimensions column to overlay_packs
    - Make task_id nullable in repair_sessions table
*/

-- Add baseline_dimensions column to overlay_packs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'overlay_packs' AND column_name = 'baseline_dimensions'
  ) THEN
    ALTER TABLE overlay_packs ADD COLUMN baseline_dimensions JSONB;
  END IF;
END $$;

-- Make task_id nullable in repair_sessions for AI-generated tasks
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_sessions' 
    AND column_name = 'task_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE repair_sessions ALTER COLUMN task_id DROP NOT NULL;
  END IF;
END $$;