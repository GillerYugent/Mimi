package git

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrAlreadyExists   = errors.New("repo already connected")
)

type repoRecord struct {
	Repository
	AccessToken string
}

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const cols = `
    id, project_id, provider, repo_url, repo_path, access_token,
    connected_by, connected_at
`

func scan(row pgx.Row, r *repoRecord) error {
	var token *string
	if err := row.Scan(
		&r.ID, &r.ProjectID, &r.Provider, &r.RepoURL, &r.RepoPath, &token,
		&r.ConnectedBy, &r.ConnectedAt,
	); err != nil {
		return err
	}
	if token != nil {
		r.AccessToken = *token
	}
	return nil
}

func (r *Repo) Create(ctx context.Context, rec repoRecord) (*repoRecord, error) {
	out := &repoRecord{}
	var token *string
	if rec.AccessToken != "" {
		t := rec.AccessToken
		token = &t
	}
	err := scan(r.pool.QueryRow(ctx, `
		INSERT INTO git_repositories (project_id, provider, repo_url, repo_path, access_token, connected_by)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING `+cols,
		rec.ProjectID, rec.Provider, rec.RepoURL, rec.RepoPath, token, rec.ConnectedBy,
	), out)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, err
	}
	return out, nil
}

func (r *Repo) ByID(ctx context.Context, id string) (*repoRecord, error) {
	out := &repoRecord{}
	err := scan(r.pool.QueryRow(ctx, `SELECT `+cols+` FROM git_repositories WHERE id = $1`, id), out)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repo) ByProject(ctx context.Context, projectID string) (*repoRecord, error) {
	out := &repoRecord{}
	err := scan(r.pool.QueryRow(ctx, `SELECT `+cols+` FROM git_repositories WHERE project_id = $1`, projectID), out)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM git_repositories WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
