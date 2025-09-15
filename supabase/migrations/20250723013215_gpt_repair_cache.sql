-- Create gpt_repair_cache table for storing OpenAI GPT-generated repair instructions
CREATE TABLE IF NOT EXISTS gpt_repair_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vin TEXT NOT NULL,
  repair_type TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year TEXT NOT NULL,
  engine_type TEXT NOT NULL,
  gpt_response JSON NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Create unique constraint to prevent duplicate cache entries
  UNIQUE(vin, repair_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gpt_repair_cache_vin_repair_type ON gpt_repair_cache(vin, repair_type);
CREATE INDEX IF NOT EXISTS idx_gpt_repair_cache_created_at ON gpt_repair_cache(created_at);

-- Add comments for clarity
COMMENT ON TABLE gpt_repair_cache IS 'Cache table for OpenAI GPT-generated repair instructions';
COMMENT ON COLUMN gpt_repair_cache.vin IS 'Vehicle Identification Number';
COMMENT ON COLUMN gpt_repair_cache.repair_type IS 'Type of repair (e.g., brake_pads, oil_change, battery_replacement, air_filter, spark_plugs)';
COMMENT ON COLUMN gpt_repair_cache.gpt_response IS 'JSON array of repair steps from OpenAI GPT'; 