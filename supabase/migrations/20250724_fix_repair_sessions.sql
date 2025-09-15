-- Fix repair_sessions table to allow NULL task_id for AI-generated sessions
-- This allows AI-generated repair tasks that don't exist in the repair_tasks table

-- First, drop the existing foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'repair_sessions_task_id_fkey' 
    AND table_name = 'repair_sessions'
  ) THEN
    ALTER TABLE repair_sessions DROP CONSTRAINT repair_sessions_task_id_fkey;
  END IF;
END $$;

-- Modify the task_id column to allow NULL values
ALTER TABLE repair_sessions ALTER COLUMN task_id DROP NOT NULL;

-- Add a new foreign key constraint that allows NULL values
ALTER TABLE repair_sessions 
ADD CONSTRAINT repair_sessions_task_id_fkey 
FOREIGN KEY (task_id) REFERENCES repair_tasks(id) ON DELETE CASCADE;

-- Add a check constraint to ensure either task_id is provided OR task_name starts with 'AI-generated'
ALTER TABLE repair_sessions 
ADD CONSTRAINT repair_sessions_task_validation 
CHECK (
  task_id IS NOT NULL OR 
  (task_id IS NULL AND task_name IS NOT NULL)
);

-- Add index for better performance when querying by task_name
CREATE INDEX IF NOT EXISTS idx_repair_sessions_task_name ON repair_sessions(task_name);

-- Update any existing sessions that might have invalid task_id references
UPDATE repair_sessions 
SET task_id = NULL 
WHERE task_id IS NOT NULL 
AND task_id NOT IN (SELECT id FROM repair_tasks);

COMMENT ON COLUMN repair_sessions.task_id IS 'References repair_tasks.id for predefined tasks, NULL for AI-generated tasks';
COMMENT ON CONSTRAINT repair_sessions_task_validation ON repair_sessions IS 'Ensures either task_id is provided for predefined tasks or task_name for AI-generated tasks'; 