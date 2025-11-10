-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Optionally, make the first user an admin (update with your admin email)
-- UPDATE users SET is_admin = TRUE WHERE email = 'your-admin@zju.edu.cn';
