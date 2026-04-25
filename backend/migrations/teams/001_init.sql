-- teams-service владеет БД mimi_teams. Связи на пользователей — мягкие
-- UUID без FK (users живут в другой БД).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS teams (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(180) NOT NULL,
    owner_id   UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teams_owner_idx ON teams (owner_id);

-- Роли создаются для конкретной команды (Backend, Frontend, Designer, QA
-- + произвольные). permissions — JSONB-объект с флагами доступа.
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        VARCHAR(120) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{
        "canViewDocs":   true,
        "canEditDocs":   true,
        "canViewTasks":  true,
        "canEditTasks":  true,
        "canViewBoards": true,
        "canEditBoards": true,
        "canManageTeam": false
    }'::jsonb
);

CREATE INDEX IF NOT EXISTS roles_team_idx ON roles (team_id);

-- Членство в команде. role_id опционален: владелец и только что
-- приглашённый участник могут не иметь роли.
CREATE TABLE IF NOT EXISTS team_members (
    team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL,
    role_id   UUID REFERENCES roles(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members (user_id);

CREATE TABLE IF NOT EXISTS invitations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email      VARCHAR(255) NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','declined','cancelled')),
    invited_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitations_team_idx          ON invitations (team_id);
CREATE INDEX IF NOT EXISTS invitations_email_pending_idx ON invitations (LOWER(email)) WHERE status = 'pending';
