-- Migration: Add file storage refactor fields and tag_presets table
-- Date: 2025-03-15
-- Description: Adds new fields to files table for structured metadata and creates tag_presets table

-- Add new fields to files table
ALTER TABLE files ADD COLUMN original_filename VARCHAR(255);
ALTER TABLE files ADD COLUMN activity_date DATE;
ALTER TABLE files ADD COLUMN activity_type VARCHAR(50);
ALTER TABLE files ADD COLUMN instructor VARCHAR(100);
ALTER TABLE files ADD COLUMN is_legacy BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for new fields
CREATE INDEX idx_files_activity_date ON files(activity_date);
CREATE INDEX idx_files_activity_type ON files(activity_type);
CREATE INDEX idx_files_instructor ON files(instructor);

-- Mark all existing files as legacy
UPDATE files SET is_legacy = TRUE;

-- Create tag_presets table
CREATE TABLE tag_presets (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    value VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL REFERENCES users(id),
    CONSTRAINT uq_category_value UNIQUE (category, value)
);

-- Create index for category lookups
CREATE INDEX idx_tag_presets_category ON tag_presets(category);
