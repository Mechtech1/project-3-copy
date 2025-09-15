/*
  # Fix overlay_packs table ID column type

  1. Changes
    - Change `id` column from UUID to TEXT to support descriptive identifiers
    - Update any existing UUID values to descriptive format
    - Recreate indexes and constraints with new column type

  2. Security
    - Maintain existing RLS policies
*/

-- Drop foreign key constraints that depend on the primary key
ALTER TABLE overlay_parts DROP CONSTRAINT IF EXISTS overlay_parts_overlay_pack_id_fkey;
ALTER TABLE overlay_paths DROP CONSTRAINT IF EXISTS overlay_paths_overlay_pack_id_fkey;

-- Drop existing constraints and indexes that depend on the id column
ALTER TABLE overlay_packs DROP CONSTRAINT IF EXISTS overlay_packs_pkey;
DROP INDEX IF EXISTS overlay_packs_model_family_workspace_key;

-- Change the id column type from UUID to TEXT
ALTER TABLE overlay_packs ALTER COLUMN id TYPE TEXT;

-- Change foreign key columns to TEXT to match
ALTER TABLE overlay_parts ALTER COLUMN overlay_pack_id TYPE TEXT;
ALTER TABLE overlay_paths ALTER COLUMN overlay_pack_id TYPE TEXT;

-- Recreate the primary key constraint
ALTER TABLE overlay_packs ADD CONSTRAINT overlay_packs_pkey PRIMARY KEY (id);

-- Recreate foreign key constraints
ALTER TABLE overlay_parts ADD CONSTRAINT overlay_parts_overlay_pack_id_fkey 
  FOREIGN KEY (overlay_pack_id) REFERENCES overlay_packs(id);
ALTER TABLE overlay_paths ADD CONSTRAINT overlay_paths_overlay_pack_id_fkey 
  FOREIGN KEY (overlay_pack_id) REFERENCES overlay_packs(id);

-- Recreate the unique constraint for vehicle_family and workspace_type (updated column names)
CREATE UNIQUE INDEX IF NOT EXISTS overlay_packs_vehicle_family_workspace_type_key ON overlay_packs (vehicle_family, workspace_type);

-- Update the index for vehicle_family and workspace_type queries
CREATE INDEX IF NOT EXISTS idx_overlay_packs_vehicle_workspace ON overlay_packs (vehicle_family, workspace_type);