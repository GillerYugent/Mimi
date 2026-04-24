-- docs-service: таблицы страниц с заметками и версий изменений.
-- Блоки редактора хранятся как JSONB (см. тип Block во фронтенде) —
-- схему блоков не валидируем на уровне БД, это позволяет редактору
-- эволюционировать без миграций.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS doc_pages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID,
    my_space_id    UUID,
    parent_page_id UUID REFERENCES doc_pages(id) ON DELETE CASCADE,
    title          VARCHAR(500) NOT NULL DEFAULT '',
    icon           VARCHAR(8),
    blocks         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by     UUID NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ровно один из скоупов обязателен (xor).
    CONSTRAINT doc_pages_scope_chk CHECK (
        (project_id IS NOT NULL) <> (my_space_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS doc_pages_project_idx  ON doc_pages (project_id)  WHERE project_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS doc_pages_my_space_idx ON doc_pages (my_space_id) WHERE my_space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS doc_pages_parent_idx   ON doc_pages (parent_page_id);
CREATE INDEX IF NOT EXISTS doc_pages_updated_idx  ON doc_pages (updated_at DESC);

CREATE TABLE IF NOT EXISTS doc_versions (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id   UUID NOT NULL REFERENCES doc_pages(id) ON DELETE CASCADE,
    title     VARCHAR(500) NOT NULL,
    blocks    JSONB NOT NULL,
    saved_by  UUID NOT NULL,
    saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doc_versions_page_saved_idx ON doc_versions (page_id, saved_at DESC);
