-- Migration: Create conversations table
-- Version: 001
-- Description: Initial schema for conversations

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    userid TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_userid 
ON conversations(userid);

CREATE INDEX IF NOT EXISTS idx_conversations_userid_created_at 
ON conversations(userid, created_at DESC);
