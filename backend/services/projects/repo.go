package projects

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
)

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

func (r *Repo) Create(ctx context.Context, ownerID string, req CreateRequest) (*Project, error) {
	p := &Project{}
	icon := req.Icon
	if icon == "" {
		icon = "📁"
	}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO projects (title, description, owner_id, team_id, icon)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, title, description, owner_id, team_id, status, icon, created_at, updated_at
	`, req.Title, req.Description, ownerID, req.TeamID, icon).Scan(
		&p.ID, &p.Title, &p.Description, &p.OwnerID, &p.TeamID,
		&p.Status, &p.Icon, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repo) ByID(ctx context.Context, id string) (*Project, error) {
	p := &Project{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, title, description, owner_id, team_id, status, icon, created_at, updated_at
		FROM projects WHERE id = $1
	`, id).Scan(
		&p.ID, &p.Title, &p.Description, &p.OwnerID, &p.TeamID,
		&p.Status, &p.Icon, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repo) ListByOwner(ctx context.Context, ownerID string, status ProjectStatus) ([]Project, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, title, description, owner_id, team_id, status, icon, created_at, updated_at
		FROM projects
		WHERE owner_id = $1 AND status = $2
		ORDER BY updated_at DESC
	`, ownerID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(
			&p.ID, &p.Title, &p.Description, &p.OwnerID, &p.TeamID,
			&p.Status, &p.Icon, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ListByOwnerOrTeams returns projects owned by the user OR belonging to any
// of the provided team IDs (team-member projects). Falls back to ListByOwner
// when teamIDs is empty.
func (r *Repo) ListByOwnerOrTeams(ctx context.Context, ownerID string, teamIDs []string, status ProjectStatus) ([]Project, error) {
	if len(teamIDs) == 0 {
		return r.ListByOwner(ctx, ownerID, status)
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, title, description, owner_id, team_id, status, icon, created_at, updated_at
		FROM projects
		WHERE (owner_id = $1 OR team_id = ANY($3)) AND status = $2
		ORDER BY updated_at DESC
	`, ownerID, status, teamIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(
			&p.ID, &p.Title, &p.Description, &p.OwnerID, &p.TeamID,
			&p.Status, &p.Icon, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Update применяет частичное обновление: неnil-поля. Возвращает актуальную запись.
func (r *Repo) Update(ctx context.Context, id string, req UpdateRequest) (*Project, error) {
	_, err := r.pool.Exec(ctx, `
		UPDATE projects SET
		    title       = COALESCE($2, title),
		    description = COALESCE($3, description),
		    icon        = COALESCE($4, icon),
		    team_id     = COALESCE($5, team_id),
		    updated_at  = NOW()
		WHERE id = $1
	`, id, req.Title, req.Description, req.Icon, req.TeamID)
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *Repo) SetStatus(ctx context.Context, id string, status ProjectStatus) (*Project, error) {
	_, err := r.pool.Exec(ctx, `
		UPDATE projects SET status = $2, updated_at = NOW() WHERE id = $1
	`, id, status)
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
