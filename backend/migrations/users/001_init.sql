-- users-service добавляет свою таблицу в общую БД `mimi_users`.
-- Таблица `users` создаётся миграцией auth-service'а (см. migrations/auth/001_init.sql).
-- Здесь — только my_spaces, т.к. концепция My Space по ТЗ (практика 7)
-- принадлежит users-service.
--
-- FK на users.id намеренно не ставим: это кросс-сервисный reference в рамках
-- общей БД, и мы избегаем жёсткой связи, чтобы не конфликтовать с порядком
-- миграций. Целостность на уровне приложения.

CREATE TABLE IF NOT EXISTS my_spaces (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS my_spaces_user_id_idx ON my_spaces (user_id);
