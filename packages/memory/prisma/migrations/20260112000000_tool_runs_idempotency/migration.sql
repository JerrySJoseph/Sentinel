ALTER TABLE "tool_runs"
  ADD COLUMN IF NOT EXISTS "request_id" uuid,
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE INDEX IF NOT EXISTS "tool_runs_request_id_idx" ON "tool_runs"("request_id");

-- Unique idempotency guard: multiple NULLs are allowed; when idempotency_key is set,
-- duplicates for the same (session_id, tool_call_id, idempotency_key) are rejected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'tool_runs_idempotency_uniq'
  ) THEN
    CREATE UNIQUE INDEX "tool_runs_idempotency_uniq"
      ON "tool_runs"("session_id", "tool_call_id", "idempotency_key");
  END IF;
END $$;

