package teams

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

// ─── Teams ───────────────────────────────────────────────────────

func (r *Repo) CreateTeam(ctx context.Context, name, ownerID string) (*Team, error) {
	t := &Team{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO teams (name, owner_id) VALUES ($1, $2)
		RETURNING id, name, owner_id, created_at
	`, name, ownerID).Scan(&t.ID, &t.Name, &t.OwnerID, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Repo) Team(ctx context.Context, id string) (*Team, error) {
	t := &Team{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, owner_id, created_at FROM teams WHERE id = $1
	`, id).Scan(&t.ID, &t.Name, &t.OwnerID, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

// TeamsByUser возвращает команды, где user — владелец или член.
func (r *Repo) TeamsByUser(ctx context.Context, userID string) ([]Team, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT t.id, t.name, t.owner_id, t.created_at
		FROM teams t
		LEFT JOIN team_members m ON m.team_id = t.id AND m.user_id = $1
		WHERE t.owner_id = $1 OR m.user_id = $1
		GROUP BY t.id
		ORDER BY t.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Team{}
	for rows.Next() {
		var t Team
		if err := rows.Scan(&t.ID, &t.Name, &t.OwnerID, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *Repo) RenameTeam(ctx context.Context, id, name string) (*Team, error) {
	_, err := r.pool.Exec(ctx, `UPDATE teams SET name = $2 WHERE id = $1`, id, name)
	if err != nil {
		return nil, err
	}
	return r.Team(ctx, id)
}

func (r *Repo) DeleteTeam(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM teams WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─── Roles ───────────────────────────────────────────────────────

func (r *Repo) CreateRole(ctx context.Context, teamID, name string, perms Permissions) (*Role, error) {
	pj, err := json.Marshal(perms)
	if err != nil {
		return nil, err
	}
	role := &Role{}
	var raw []byte
	err = r.pool.QueryRow(ctx, `
		INSERT INTO roles (team_id, name, permissions) VALUES ($1, $2, $3)
		RETURNING id, team_id, name, permissions
	`, teamID, name, pj).Scan(&role.ID, &role.TeamID, &role.Name, &raw)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &role.Permissions); err != nil {
		return nil, err
	}
	return role, nil
}

func (r *Repo) Role(ctx context.Context, id string) (*Role, error) {
	role := &Role{}
	var raw []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, team_id, name, permissions FROM roles WHERE id = $1
	`, id).Scan(&role.ID, &role.TeamID, &role.Name, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &role.Permissions); err != nil {
		return nil, err
	}
	return role, nil
}

func (r *Repo) RolesByTeam(ctx context.Context, teamID string) ([]Role, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, team_id, name, permissions FROM roles WHERE team_id = $1 ORDER BY name
	`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Role{}
	for rows.Next() {
		var role Role
		var raw []byte
		if err := rows.Scan(&role.ID, &role.TeamID, &role.Name, &raw); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &role.Permissions); err != nil {
			return nil, err
		}
		out = append(out, role)
	}
	return out, rows.Err()
}

func (r *Repo) UpdateRole(ctx context.Context, id string, name *string, perms *Permissions) (*Role, error) {
	var permArg any
	if perms != nil {
		pj, err := json.Marshal(perms)
		if err != nil {
			return nil, err
		}
		permArg = pj
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE roles SET
		    name        = COALESCE($2, name),
		    permissions = COALESCE($3::jsonb, permissions)
		WHERE id = $1
	`, id, name, permArg)
	if err != nil {
		return nil, err
	}
	return r.Role(ctx, id)
}

func (r *Repo) DeleteRole(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM roles WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─── Members ─────────────────────────────────────────────────────

// AddMember идемпотентен: повторный вызов с тем же (team, user) обновит role_id.
func (r *Repo) AddMember(ctx context.Context, teamID, userID string, roleID *string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO team_members (team_id, user_id, role_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (team_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id
	`, teamID, userID, roleID)
	return err
}

func (r *Repo) RemoveMember(ctx context.Context, teamID, userID string) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM team_members WHERE team_id = $1 AND user_id = $2
	`, teamID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) MembersByTeam(ctx context.Context, teamID string) ([]Member, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT team_id, user_id, role_id, joined_at
		FROM team_members WHERE team_id = $1
		ORDER BY joined_at ASC
	`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.TeamID, &m.UserID, &m.RoleID, &m.JoinedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repo) Member(ctx context.Context, teamID, userID string) (*Member, error) {
	m := &Member{}
	err := r.pool.QueryRow(ctx, `
		SELECT team_id, user_id, role_id, joined_at
		FROM team_members WHERE team_id = $1 AND user_id = $2
	`, teamID, userID).Scan(&m.TeamID, &m.UserID, &m.RoleID, &m.JoinedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return m, nil
}

// ─── Invitations ─────────────────────────────────────────────────

func (r *Repo) CreateInvitation(ctx context.Context, teamID, email, invitedBy string) (*Invitation, error) {
	inv := &Invitation{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO invitations (team_id, email, invited_by)
		VALUES ($1, $2, $3)
		RETURNING id, team_id, email, status, invited_by, created_at
	`, teamID, strings.ToLower(strings.TrimSpace(email)), invitedBy).Scan(
		&inv.ID, &inv.TeamID, &inv.Email, &inv.Status, &inv.InvitedBy, &inv.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func (r *Repo) Invitation(ctx context.Context, id string) (*Invitation, error) {
	inv := &Invitation{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, team_id, email, status, invited_by, created_at
		FROM invitations WHERE id = $1
	`, id).Scan(&inv.ID, &inv.TeamID, &inv.Email, &inv.Status, &inv.InvitedBy, &inv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return inv, nil
}

func (r *Repo) InvitationsByTeam(ctx context.Context, teamID string) ([]Invitation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, team_id, email, status, invited_by, created_at
		FROM invitations WHERE team_id = $1
		ORDER BY created_at DESC
	`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Invitation{}
	for rows.Next() {
		var inv Invitation
		if err := rows.Scan(&inv.ID, &inv.TeamID, &inv.Email, &inv.Status, &inv.InvitedBy, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (r *Repo) PendingForEmail(ctx context.Context, email string) ([]Invitation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, team_id, email, status, invited_by, created_at
		FROM invitations WHERE LOWER(email) = LOWER($1) AND status = 'pending'
		ORDER BY created_at DESC
	`, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Invitation{}
	for rows.Next() {
		var inv Invitation
		if err := rows.Scan(&inv.ID, &inv.TeamID, &inv.Email, &inv.Status, &inv.InvitedBy, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (r *Repo) UpdateInvitationStatus(ctx context.Context, id string, status InvitationStatus) error {
	tag, err := r.pool.Exec(ctx, `UPDATE invitations SET status = $2 WHERE id = $1`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
