-- Add image_url column to overlay_packs table for PNG overlay support
-- Make workspace_svg optional since we now support direct PNG overlays

-- Add image_url column for DALL-E 3 PNG URLs
ALTER TABLE overlay_packs ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Make workspace_svg nullable since PNG mode doesn't need it (only if column exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'overlay_packs' AND column_name = 'workspace_svg') THEN
        ALTER TABLE overlay_packs ALTER COLUMN workspace_svg DROP NOT NULL;
    END IF;
END $$;

-- Add baseline_dimensions column if it doesn't exist (fixes PGRST204 error)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'overlay_packs' AND column_name = 'baseline_dimensions') THEN
        ALTER TABLE overlay_packs ADD COLUMN baseline_dimensions JSONB NOT NULL DEFAULT '{"width": 1000, "height": 600}';
    END IF;
END $$;

-- Create index for image_url lookups
CREATE INDEX IF NOT EXISTS idx_overlay_packs_image_url ON overlay_packs(image_url) WHERE image_url IS NOT NULL;

-- Update RLS policies to handle both SVG and PNG modes
-- (existing policies already cover the new column)
