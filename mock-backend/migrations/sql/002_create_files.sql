-- Migration: Create files table
-- Version: 002
-- Description: Schema for file indexing metadata

CREATE TABLE IF NOT EXISTS files (
    file_id TEXT PRIMARY KEY,
    userid TEXT NOT NULL,
    filename TEXT NOT NULL,
    blob_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    uploaded_at BIGINT NOT NULL,
    indexed_at BIGINT,
    error_message TEXT,
    workflow_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_userid 
ON files(userid);

CREATE INDEX IF NOT EXISTS idx_files_status 
ON files(status);
