-- Enable gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum for Message.role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageRole') THEN
    CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL,
  "role" "MessageRole" NOT NULL,
  "content" text NOT NULL,
  "tool_call_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "messages_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "messages_session_id_idx" ON "messages"("session_id");

CREATE TABLE IF NOT EXISTS "tool_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL,
  "tool_call_id" uuid NOT NULL,
  "name" text NOT NULL,
  "args" jsonb NOT NULL,
  "ok" boolean NOT NULL,
  "result" jsonb,
  "error" jsonb,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "duration_ms" integer,
  "truncated" boolean,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tool_runs_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "tool_runs_session_id_idx" ON "tool_runs"("session_id");
CREATE INDEX IF NOT EXISTS "tool_runs_tool_call_id_idx" ON "tool_runs"("tool_call_id");

