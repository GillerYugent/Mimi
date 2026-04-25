-- boards-service владеет БД mimi_boards. Канвас — это контейнер для
-- произвольного набора элементов (блоки, стикеры, текст, mind-nodes,
-- стрелки), хранящихся одним JSONB-массивом. Точно так же как в
-- doc_pages, мы не валидируем схему элемента на уровне БД — это
-- зона ответственности клиента (CanvasElement в типах фронтенда).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS canvases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID,
    my_space_id UUID,
    title       VARCHAR(255) NOT NULL DEFAULT '',
    elements    JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ровно один scope.
    CONSTRAINT canvases_scope_chk CHECK (
        (project_id IS NOT NULL) <> (my_space_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS canvases_project_idx  ON canvases (project_id)  WHERE project_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS canvases_my_space_idx ON canvases (my_space_id) WHERE my_space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS canvases_updated_idx  ON canvases (updated_at DESC);
