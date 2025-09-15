-- Create overlay_packs table for universal ghost overlay system
CREATE TABLE IF NOT EXISTS overlay_packs (
  id TEXT PRIMARY KEY,
  vehicle_family TEXT NOT NULL,
  workspace_type TEXT NOT NULL,
  workspace_svg TEXT NOT NULL,
  baseline_dimensions JSONB NOT NULL,
  parts JSONB NOT NULL,
  access_paths JSONB,
  layers JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gpt_model TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_overlay_packs_vehicle_family ON overlay_packs(vehicle_family);
CREATE INDEX IF NOT EXISTS idx_overlay_packs_workspace_type ON overlay_packs(workspace_type);
CREATE INDEX IF NOT EXISTS idx_overlay_packs_family_workspace ON overlay_packs(vehicle_family, workspace_type);
CREATE INDEX IF NOT EXISTS idx_overlay_packs_usage_count ON overlay_packs(usage_count DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_overlay_packs_updated_at BEFORE UPDATE ON overlay_packs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE overlay_packs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read overlay packs
CREATE POLICY "Allow authenticated read access" ON overlay_packs FOR SELECT TO authenticated USING (true);

-- Allow service role full access (for GPT generation)
CREATE POLICY "Allow service role full access" ON overlay_packs FOR ALL TO service_role USING (true);

-- Allow anonymous users to insert overlay packs (for client-side generation)
CREATE POLICY "Allow anonymous insert access" ON overlay_packs FOR INSERT TO anon USING (true);
