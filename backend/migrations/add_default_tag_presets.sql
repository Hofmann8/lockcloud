-- Migration: Add default tag presets
-- Description: Initialize default activity types and instructor presets
-- Date: 2025-01-XX

-- Note: This migration assumes at least one admin user exists
-- Run init_tag_presets.py script instead if you need to create the system admin

-- Get the first admin user ID (or use 1 as fallback)
-- In production, replace with actual admin user ID

-- Insert default activity types if they don't exist
INSERT INTO tag_presets (category, value, display_name, is_active, created_at, created_by)
SELECT 'activity_type', 'regular_training', '例训', 1, datetime('now'), 1
WHERE NOT EXISTS (SELECT 1 FROM tag_presets WHERE category = 'activity_type' AND value = 'regular_training');

INSERT INTO tag_presets (category, value, display_name, is_active, created_at, created_by)
SELECT 'activity_type', 'internal_training', '内训', 1, datetime('now'), 1
WHERE NOT EXISTS (SELECT 1 FROM tag_presets WHERE category = 'activity_type' AND value = 'internal_training');

INSERT INTO tag_presets (category, value, display_name, is_active, created_at, created_by)
SELECT 'activity_type', 'master_class', '大师课', 1, datetime('now'), 1
WHERE NOT EXISTS (SELECT 1 FROM tag_presets WHERE category = 'activity_type' AND value = 'master_class');

INSERT INTO tag_presets (category, value, display_name, is_active, created_at, created_by)
SELECT 'activity_type', 'special_event', '特殊活动', 1, datetime('now'), 1
WHERE NOT EXISTS (SELECT 1 FROM tag_presets WHERE category = 'activity_type' AND value = 'special_event');

-- Insert default instructor preset (none option)
INSERT INTO tag_presets (category, value, display_name, is_active, created_at, created_by)
SELECT 'instructor', 'none', '无', 1, datetime('now'), 1
WHERE NOT EXISTS (SELECT 1 FROM tag_presets WHERE category = 'instructor' AND value = 'none');

-- Verify insertions
SELECT 'Activity Types:' as info;
SELECT id, value, display_name, is_active FROM tag_presets WHERE category = 'activity_type';

SELECT 'Instructors:' as info;
SELECT id, value, display_name, is_active FROM tag_presets WHERE category = 'instructor';
