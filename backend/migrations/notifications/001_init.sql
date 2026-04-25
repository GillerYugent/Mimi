-- notifications-service владеет БД mimi_notifications. Хранит входящий
-- журнал уведомлений на каждого пользователя. Доставка реальному клиенту
-- через SSE — это уровень транспорта, в БД пишем сразу для надёжности
-- (offline-клиент увидит при следующем GET /notifications).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    type       VARCHAR(60) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    link       TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Самый частый запрос — выдать пользователю последние уведомления (свежие
-- сверху). Покрывающий индекс по (user_id, created_at DESC).
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx  ON notifications (user_id) WHERE is_read = FALSE;
