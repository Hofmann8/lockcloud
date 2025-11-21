-- Add UPDATE operation type to file_logs table
-- This migration adds the 'update' operation type to the OperationType enum

-- For PostgreSQL
-- ALTER TYPE operationtype ADD VALUE IF NOT EXISTS 'update';

-- For SQLite (recreate the table with new enum values)
-- Note: SQLite doesn't support ALTER TYPE, so we need to handle this differently
-- The enum is handled by SQLAlchemy, so just ensure the column can accept the new value

-- This is a no-op migration for SQLite as the enum is handled by SQLAlchemy
-- The new enum value will be available once the models.py is updated

-- For MySQL
-- ALTER TABLE file_logs MODIFY COLUMN operation ENUM('upload', 'delete', 'access', 'update') NOT NULL;

-- Note: Since we're using SQLAlchemy with SQLite, the enum constraint is not enforced at the database level
-- The application code (models.py) has been updated to include the UPDATE operation type
