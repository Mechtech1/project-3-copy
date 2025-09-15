-- Add missing image_url column to overlay_packs table
-- This column stores the direct PNG overlay URL from DALL-E 3

-- Add the image_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overlay_packs' 
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE overlay_packs ADD COLUMN image_url TEXT;
        RAISE NOTICE 'Added image_url column to overlay_packs table';
    ELSE
        RAISE NOTICE 'image_url column already exists in overlay_packs table';
    END IF;
END $$;

-- Make workspace_svg optional since we now have image_url as alternative
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overlay_packs' 
        AND column_name = 'workspace_svg'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE overlay_packs ALTER COLUMN workspace_svg DROP NOT NULL;
        RAISE NOTICE 'Made workspace_svg column nullable in overlay_packs table';
    ELSE
        RAISE NOTICE 'workspace_svg column is already nullable or does not exist';
    END IF;
END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
