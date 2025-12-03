-- Migration: Add directory_info column to file_requests table
-- This allows storing directory edit requests that don't link to a single file

-- Make file_id nullable (for directory requests)
-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- For production PostgreSQL/MySQL, use: ALTER TABLE file_requests ALTER COLUMN file_id DROP NOT NULL;

-- Add directory_info column
ALTER TABLE file_requests ADD COLUMN directory_info JSON;

-- Note: For SQLite, if file_id is already NOT NULL, you may need to:
-- 1. Create a new table with the correct schema
-- 2. Copy data from old table
-- 3. Drop old table
-- 4. Rename new table

-- Example for SQLite full migration:
-- CREATE TABLE file_requests_new (
--     id INTEGER PRIMARY KEY,
--     file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,  -- Now nullable
--     requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     request_type VARCHAR(20) NOT NULL,
--     status VARCHAR(20) NOT NULL DEFAULT 'pending',
--     proposed_changes JSON,
--     directory_info JSON,
--     message TEXT,
--     response_message TEXT,
--     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );
-- INSERT INTO file_requests_new SELECT id, file_id, requester_id, owner_id, request_type, status, proposed_changes, NULL, message, response_message, created_at, updated_at FROM file_requests;
-- DROP TABLE file_requests;
-- ALTER TABLE file_requests_new RENAME TO file_requests;
-- CREATE INDEX idx_requests_owner_status ON file_requests(owner_id, status);
-- CREATE INDEX idx_requests_requester ON file_requests(requester_id);
