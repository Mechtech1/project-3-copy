-- Add gpt_model column to overlay_packs table if it doesn't exist
-- This addresses the PGRST204 error: "Could not find the 'gpt_model' column of 'overlay_packs' in the schema cache"

DO $$
BEGIN
    -- Check if gpt_model column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'overlay_packs' 
        AND column_name = 'gpt_model'
    ) THEN
        ALTER TABLE overlay_packs ADD COLUMN gpt_model TEXT NOT NULL DEFAULT 'hybrid-deepseek-dalle3';
        RAISE NOTICE 'Added gpt_model column to overlay_packs table';
    ELSE
        RAISE NOTICE 'gpt_model column already exists in overlay_packs table';
    END IF;
END $$;

-- Ensure the column is properly indexed for performance
CREATE INDEX IF NOT EXISTS idx_overlay_packs_gpt_model ON overlay_packs(gpt_model);

-- Refresh the schema cache by updating table comment
COMMENT ON TABLE overlay_packs IS 'Universal ghost overlay system - Updated at migration';
