-- Migration: Add avatar_key to users table
-- Date: 2026-01-07
-- Description: Add avatar_key field for user profile pictures stored in public S3 bucket

-- Add avatar_key column to users table
ALTER TABLE users ADD COLUMN avatar_key VARCHAR(255) DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN users.avatar_key IS 'S3 key for user avatar in public bucket';
