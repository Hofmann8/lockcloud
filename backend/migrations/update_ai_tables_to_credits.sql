-- Migration: Update AI tables from tokens to credits
-- Date: 2025-11-19
-- Description: Replace token tracking with credits tracking

-- Update ai_conversations table
ALTER TABLE ai_conversations DROP COLUMN IF EXISTS prompt_tokens;
ALTER TABLE ai_conversations DROP COLUMN IF EXISTS completion_tokens;
ALTER TABLE ai_conversations DROP COLUMN IF EXISTS total_tokens;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS total_credits INTEGER NOT NULL DEFAULT 0;

-- Update ai_messages table
ALTER TABLE ai_messages DROP COLUMN IF EXISTS tokens;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- Comments
COMMENT ON COLUMN ai_conversations.total_credits IS 'Total credits used in this conversation';
COMMENT ON COLUMN ai_messages.credits IS 'Credits used for this message (5c for gpt-5, 7c for gpt-5-thinking)';
