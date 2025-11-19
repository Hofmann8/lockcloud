-- Migration: Add AI conversation tables
-- Date: 2025-11-19
-- Description: Adds tables for LockAI feature to support AI conversations and token tracking

-- Create ai_conversations table
CREATE TABLE ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model VARCHAR(50) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create ai_messages table
CREATE TABLE ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_created_at ON ai_conversations(created_at);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at);

-- Comments
COMMENT ON TABLE ai_conversations IS 'AI conversation sessions with token usage tracking';
COMMENT ON TABLE ai_messages IS 'Individual messages within AI conversations';
COMMENT ON COLUMN ai_conversations.model IS 'AI model used (e.g., gpt-3.5-turbo, gpt-4)';
COMMENT ON COLUMN ai_messages.role IS 'Message role: user or assistant';
COMMENT ON COLUMN ai_messages.tokens IS 'Token count for this message';
