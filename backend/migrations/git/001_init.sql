-- git-service владеет БД mimi_git. Хранит привязку проекта к внешнему
-- репозиторию (GitHub / GitLab). access_token — PAT пользователя или токен,
-- полученный через OAuth-flow. В production его нужно шифровать на уровне
-- приложения; для MVP оставлен в виде TEXT.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS git_repositories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL,
    provider     VARCHAR(20) NOT NULL CHECK (provider IN ('github','gitlab')),
    repo_url     TEXT        NOT NULL,
    -- Извлекаемое из URL: "owner/repo" для GitHub, "namespace/project"
    -- для GitLab. Используется для построения URL'ов API.
    repo_path    VARCHAR(255) NOT NULL,
    access_token TEXT,
    connected_by UUID NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Один проект = одна привязка (защита от случайных дублей).
CREATE UNIQUE INDEX IF NOT EXISTS git_repositories_project_uniq ON git_repositories (project_id);
CREATE INDEX IF NOT EXISTS git_repositories_provider_idx        ON git_repositories (provider);
