package docs

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const pageCols = `
    id, project_id, my_space_id, parent_page_id, title, icon, blocks,
    created_by, created_at, updated_at
`

func scanPage(row pgx.Row, p *Page) error {
	return row.Scan(
		&p.ID, &p.ProjectID, &p.MySpaceID, &p.ParentPageID,
		&p.Title, &p.Icon, &p.Blocks,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt,
	)
}

func (r *Repo) Create(ctx context.Context, creatorID string, req CreateRequest) (*Page, error) {
	p := &Page{}
	blocks := req.Blocks
	if len(blocks) == 0 {
		blocks = Blocks(`[]`)
	}
	err := scanPage(r.pool.QueryRow(ctx, `
		INSERT INTO doc_pages (
		    project_id, my_space_id, parent_page_id, title, icon, blocks, created_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING `+pageCols,
		req.ProjectID, req.MySpaceID, req.ParentPageID, req.Title, req.Icon, []byte(blocks), creatorID,
	), p)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repo) ByID(ctx context.Context, id string) (*Page, error) {
	p := &Page{}
	err := scanPage(r.pool.QueryRow(ctx, `SELECT `+pageCols+` FROM doc_pages WHERE id = $1`, id), p)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

// RootPages возвращает страницы верхнего уровня в заданном scope.
// parentId == NULL.
func (r *Repo) RootPages(ctx context.Context, s ScopeQuery) ([]Page, error) {
	return r.queryPages(ctx, `
		SELECT `+pageCols+` FROM doc_pages
		WHERE parent_page_id IS NULL
		  AND ($1::uuid IS NULL OR project_id  = $1)
		  AND ($2::uuid IS NULL OR my_space_id = $2)
		ORDER BY created_at ASC
	`, nullable(s.ProjectID), nullable(s.MySpaceID))
}

func (r *Repo) Children(ctx context.Context, parentID string) ([]Page, error) {
	return r.queryPages(ctx, `
		SELECT `+pageCols+` FROM doc_pages
		WHERE parent_page_id = $1
		ORDER BY created_at ASC
	`, parentID)
}

// Search: ILIKE по title + ILIKE по строковому представлению blocks.
// Подходит для небольших объёмов и минимального UX «найти заметку».
// При росте — заменить на tsvector / pg_trgm.
func (r *Repo) Search(ctx context.Context, s ScopeQuery, q string) ([]Page, error) {
	return r.queryPages(ctx, `
		SELECT `+pageCols+` FROM doc_pages
		WHERE ($1::uuid IS NULL OR project_id  = $1)
		  AND ($2::uuid IS NULL OR my_space_id = $2)
		  AND (title ILIKE '%' || $3 || '%' OR blocks::text ILIKE '%' || $3 || '%')
		ORDER BY updated_at DESC
		LIMIT 20
	`, nullable(s.ProjectID), nullable(s.MySpaceID), q)
}

func (r *Repo) queryPages(ctx context.Context, sql string, args ...any) ([]Page, error) {
	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Page{}
	for rows.Next() {
		var p Page
		if err := scanPage(rows, &p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repo) Update(ctx context.Context, id string, req UpdateRequest) (*Page, error) {
	var blocksArg any
	if req.Blocks != nil {
		blocksArg = []byte(*req.Blocks)
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE doc_pages SET
		    title      = COALESCE($2, title),
		    icon       = COALESCE($3, icon),
		    blocks     = COALESCE($4::jsonb, blocks),
		    updated_at = NOW()
		WHERE id = $1
	`, id, req.Title, req.Icon, blocksArg)
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM doc_pages WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ─── Versions ─────────────────────────────────────────────────────

func (r *Repo) SaveVersion(ctx context.Context, pageID, savedBy string) (*Version, error) {
	v := &Version{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO doc_versions (page_id, title, blocks, saved_by)
		SELECT id, title, blocks, $2 FROM doc_pages WHERE id = $1
		RETURNING id, page_id, title, blocks, saved_by, saved_at
	`, pageID, savedBy).Scan(
		&v.ID, &v.PageID, &v.Title, &v.Blocks, &v.SavedBy, &v.SavedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (r *Repo) VersionsByPage(ctx context.Context, pageID string) ([]Version, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, page_id, title, blocks, saved_by, saved_at
		FROM doc_versions
		WHERE page_id = $1
		ORDER BY saved_at DESC
		LIMIT 100
	`, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Version{}
	for rows.Next() {
		var v Version
		if err := rows.Scan(&v.ID, &v.PageID, &v.Title, &v.Blocks, &v.SavedBy, &v.SavedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// RestoreVersion копирует title/blocks из версии обратно в страницу.
func (r *Repo) RestoreVersion(ctx context.Context, versionID string) (*Page, error) {
	var pageID string
	err := r.pool.QueryRow(ctx, `
		UPDATE doc_pages p
		SET title = v.title, blocks = v.blocks, updated_at = NOW()
		FROM doc_versions v
		WHERE v.id = $1 AND v.page_id = p.id
		RETURNING p.id
	`, versionID).Scan(&pageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, pageID)
}

// nullable превращает "" в nil для передачи как SQL NULL в параметры $N::uuid.
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}
