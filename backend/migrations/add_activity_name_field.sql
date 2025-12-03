-- Migration: Add activity_name field to files table
-- Date: 2025-12-03
-- Description: Adds activity_name column for categorizing files by activity name

-- Add activity_name column
ALTER TABLE files ADD COLUMN IF NOT EXISTS activity_name VARCHAR(200);

-- Create index for activity_name
CREATE INDEX IF NOT EXISTS idx_files_activity_name ON files(activity_name);

-- Create composite index for activity_date + activity_name
CREATE INDEX IF NOT EXISTS idx_files_activity_date_name ON files(activity_date, activity_name);
