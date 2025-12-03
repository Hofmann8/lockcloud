-- Migration: Add free tags tables for user-defined categorization
-- Date: 2025-12-02
-- Description: Creates tags and file_tags tables for many-to-many relationship
-- Requirements: 7.1, 7.2

-- Create tags table for storing unique tag names
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL REFERENCES users(id)
);

-- Create index for efficient tag name lookups
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Create file_tags junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS file_tags (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id, tag_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag_id ON file_tags(tag_id);
