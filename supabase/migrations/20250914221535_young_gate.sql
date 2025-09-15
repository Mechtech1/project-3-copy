/*
  # Add complete vehicle profile columns to user_vehicles table

  1. New Columns
    - `trim` (text) - Vehicle trim level (EX, Touring, etc.)
    - `engine` (text) - Engine configuration (1.8L I4, 3.5L V6, etc.)
    - `body_style` (text) - Body style (Sedan, SUV, Truck, etc.)
    - `drivetrain` (text) - Drivetrain type (FWD, AWD, RWD)
    - `market` (text) - Market region (US, EU, JP, etc.)
    - `steering` (text) - Steering configuration (LHD, RHD)

  2. Data Migration
    - Set default values for existing records
    - Update engine_type column to new engine column

  3. Cleanup
    - Remove old engine_type column after migration
*/

-- Add new vehicle profile columns
DO $$
BEGIN
  -- Add trim column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'trim'
  ) THEN
    ALTER TABLE user_vehicles ADD COLUMN trim text;
  END IF;

  -- Add engine column (will replace engine_type)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'engine'
  ) THEN
    ALTER TABLE user_vehicles ADD COLUMN engine text;
  END IF;

  -- Add body_style column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'body_style'
  ) THEN
    ALTER TABLE user_vehicles ADD COLUMN body_style text;
  END IF;

  -- Add drivetrain column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'drivetrain'
  ) THEN
    ALTER TABLE user_vehicles ADD COLUMN drivetrain text;
  END IF;

  -- Add market column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'market'
  ) THEN
    ALTER TABLE user_vehicles ADD COLUMN market text;
  END IF;

  -- Add steering column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'steering'
  ) THEN
    ALTER TABLE user_vehicles ADD COLUMN steering text;
  END IF;
END $$;

-- Migrate data from engine_type to engine column if engine_type exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vehicles' AND column_name = 'engine_type'
  ) THEN
    -- Copy data from engine_type to engine
    UPDATE user_vehicles 
    SET engine = COALESCE(engine_type, 'Unknown')
    WHERE engine IS NULL;
    
    -- Drop the old engine_type column
    ALTER TABLE user_vehicles DROP COLUMN engine_type;
  END IF;
END $$;

-- Set default values for existing records with NULL values
UPDATE user_vehicles 
SET 
  engine = COALESCE(engine, 'Unknown'),
  body_style = COALESCE(body_style, 'Unknown'),
  drivetrain = COALESCE(drivetrain, 'Unknown'),
  market = COALESCE(market, 'Unknown'),
  steering = COALESCE(steering, 'Unknown')
WHERE 
  engine IS NULL OR 
  body_style IS NULL OR 
  drivetrain IS NULL OR 
  market IS NULL OR 
  steering IS NULL;