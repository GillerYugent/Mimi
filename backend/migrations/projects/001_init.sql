-- projects-service владеет своей БД `mimi_projects`. Информация о Git-репозитории
-- живёт отдельно в git-service (таблица git_repositories в mimi_git — см. ТЗ,
-- практика 7) и не хранится здесь.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS projects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(255) NOT NULL,
    description  TEXT         NOT NULL DEFAULT '',
    owner_id     UUID         NOT NULL,
    team_id      UUID,
    status       VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    icon         VARCHAR(8)   NOT NULL DEFAULT '📁',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_owner_idx  ON projects (owner_id, status);
CREATE INDEX IF NOT EXISTS projects_team_idx   ON projects (team_id);
CREATE INDEX IF NOT EXISTS projects_updated_idx ON projects (updated_at DESC);
