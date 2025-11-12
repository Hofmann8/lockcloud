-- Migration: Add composite indexes for optimized queries
-- Date: 2025-11-11
-- Description: Adds composite index for activity_date and activity_type to optimize common query patterns

-- Add composite index for queries filtering by both activity_date and activity_type
-- This improves performance for queries like: WHERE activity_date BETWEEN ? AND ? AND activity_type = ?
CREATE INDEX idx_files_activity_date_type ON files(activity_date, activity_type);

-- Note: Individual indexes for activity_date, activity_type, and instructor already exist
-- from the previous migration (add_file_storage_refactor_fields.sql)
