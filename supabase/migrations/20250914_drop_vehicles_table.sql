-- Drop vehicles table and all dependencies
-- This migration removes the old vehicles table that's been replaced by user_vehicles

-- First, find and drop any foreign key constraints that reference vehicles table
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all foreign key constraints that reference the vehicles table
    FOR constraint_record IN
        SELECT 
            tc.constraint_name,
            tc.table_name,
            tc.table_schema
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'vehicles'
        AND tc.table_schema = 'public'
    LOOP
        -- Drop each foreign key constraint
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            constraint_record.table_schema,
            constraint_record.table_name,
            constraint_record.constraint_name
        );
        
        RAISE NOTICE 'Dropped foreign key constraint: %.% -> %', 
            constraint_record.table_name, 
            constraint_record.constraint_name,
            'vehicles';
    END LOOP;
END $$;

-- Drop any indexes on the vehicles table
DROP INDEX IF EXISTS idx_vehicles_vin;
DROP INDEX IF EXISTS idx_vehicles_make;
DROP INDEX IF EXISTS idx_vehicles_model;
DROP INDEX IF EXISTS idx_vehicles_year;

-- Drop any policies on the vehicles table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        DROP POLICY IF EXISTS "Public read access for vehicles" ON vehicles;
    END IF;
END $$;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
        DROP POLICY IF EXISTS "Public write access for vehicles" ON vehicles;
        DROP POLICY IF EXISTS "Allow public read access" ON vehicles;
        DROP POLICY IF EXISTS "Allow public insert access" ON vehicles;
        DROP POLICY IF EXISTS "Allow public update access" ON vehicles;
    END IF;
END $$;

-- Finally, drop the vehicles table
DROP TABLE IF EXISTS vehicles CASCADE;

-- Verify the table is gone
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles' AND table_schema = 'public') THEN
        RAISE NOTICE 'Successfully dropped vehicles table';
    ELSE
        RAISE EXCEPTION 'Failed to drop vehicles table';
    END IF;
END $$;
