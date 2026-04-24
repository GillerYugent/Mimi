-- tasks-service владеет БД mimi_tasks. Ссылки на project_id / assignee_id /
-- parent_task_id — «мягкие» UUID'ы; FK только на саму таблицу tasks для
-- каскадного удаления подзадач.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tasks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID NOT NULL,
    parent_task_id   UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title            VARCHAR(500) NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    status           VARCHAR(20) NOT NULL DEFAULT 'backlog'
                       CHECK (status IN ('backlog','todo','in_progress','review','done')),
    priority         VARCHAR(20) NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high','urgent')),
    labels           TEXT[] NOT NULL DEFAULT '{}',
    assignee_id      UUID,
    deadline         TIMESTAMPTZ,
    commit_sha       VARCHAR(64),
    pull_request_url TEXT,
    sort_order       BIGINT NOT NULL DEFAULT 0,
    created_by       UUID NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON tasks (project_id, status);
CREATE INDEX IF NOT EXISTS tasks_parent_idx         ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx       ON tasks (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_deadline_idx       ON tasks (deadline)    WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_labels_gin         ON tasks USING GIN (labels);
