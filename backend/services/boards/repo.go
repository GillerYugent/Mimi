package boards

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const cols = `
    id, project_id, my_space_id, title, elements,
    created_by, created_at, updated_at
`

func scan(row pgx.Row, c *Canvas) error {
	return row.Scan(
		&c.ID, &c.ProjectID, &c.MySpaceID, &c.Title, &c.Elements,
		&c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	)
}

func (r *Repo) Create(ctx context.Context, creatorID string, req CreateRequest) (*Canvas, error) {
	c := &Canvas{}
	elements := req.Elements
	if len(elements) == 0 {
		elements = Elements(`[]`)
	}
	err := scan(r.pool.QueryRow(ctx, `
		INSERT INTO canvases (project_id, my_space_id, title, elements, created_by)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING `+cols,
		req.ProjectID, req.MySpaceID, req.Title, []byte(elements), creatorID,
	), c)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Repo) ByID(ctx context.Context, id string) (*Canvas, error) {
	c := &Canvas{}
	err := scan(r.pool.QueryRow(ctx, `SELECT `+cols+` FROM canvases WHERE id = $1`, id), c)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *Repo) List(ctx context.Context, s ScopeQuery) ([]Canvas, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+cols+` FROM canvases
		WHERE ($1::uuid IS NULL OR project_id  = $1)
		  AND ($2::uuid IS NULL OR my_space_id = $2)
		ORDER BY updated_at DESC
	`, nullable(s.ProjectID), nullable(s.MySpaceID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Canvas{}
	for rows.Next() {
		var c Canvas
		if err := scan(rows, &c); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repo) Update(ctx context.Context, id string, req UpdateRequest) (*Canvas, error) {
	var elemsArg any
	if req.Elements != nil {
		elemsArg = []byte(*req.Elements)
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE canvases SET
		    title      = COALESCE($2, title),
		    elements   = COALESCE($3::jsonb, elements),
		    updated_at = NOW()
		WHERE id = $1
	`, id, req.Title, elemsArg)
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM canvases WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
