-- Migration: Initialize default tag presets
-- Date: 2025-03-15
-- Description: Inserts default activity type presets

-- Insert default activity types
-- Note: created_by should be set to an admin user ID. 
-- Update this with your actual admin user ID after running the previous migration.
-- For now, we'll use user ID 1 as a placeholder.

INSERT INTO tag_presets (category, value, display_name, is_active, created_by)
VALUES 
    ('activity_type', 'regular_training', '例训', TRUE, 1),
    ('activity_type', 'internal_training', '内训', TRUE, 1),
    ('activity_type', 'special_event', '特殊活动', TRUE, 1),
    ('activity_type', 'master_class', '大师课', TRUE, 1)
ON CONFLICT (category, value) DO NOTHING;

-- Note: If you need to update the created_by field to a specific admin user:
-- UPDATE tag_presets SET created_by = <your_admin_user_id> WHERE created_by = 1;
