-- Users are shared between auth-service (owns writes for credentials) and
-- users-service (owns profile reads / My Space) — this matches the architecture
-- from practical works where both services point to the same `users` database.
--
-- auth-service is responsible for creating the `users` table and seeding
-- password hashes. users-service will later add a separate `my_spaces` table
-- in its own migrations.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    notification_prefs JSONB NOT NULL DEFAULT '{
        "taskAssigned": true,
        "taskStatusChanged": true,
        "teamInvited": true,
        "mentionedInDoc": true
    }'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));
