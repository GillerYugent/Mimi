package auth

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")
var ErrEmailTaken = errors.New("email already taken")

// Repo wraps raw SQL queries against the users table. No ORM per ТЗ — pgx/v5.
type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

// Create inserts a new user. Returns ErrEmailTaken on uniqueness violation.
func (r *Repo) Create(ctx context.Context, u *User) error {
	prefs, err := json.Marshal(u.NotificationPrefs)
	if err != nil {
		return err
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, notification_prefs)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`, u.Name, u.Email, u.PasswordHash, prefs)
	if err := row.Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrEmailTaken
		}
		return err
	}
	return nil
}

func (r *Repo) ByEmail(ctx context.Context, email string) (*User, error) {
	return r.queryOne(ctx, `
		SELECT id, name, email, password_hash, avatar_url, notification_prefs, created_at, updated_at
		FROM users WHERE LOWER(email) = LOWER($1)
	`, email)
}

func (r *Repo) ByID(ctx context.Context, id string) (*User, error) {
	return r.queryOne(ctx, `
		SELECT id, name, email, password_hash, avatar_url, notification_prefs, created_at, updated_at
		FROM users WHERE id = $1
	`, id)
}

// UpdateProfile applies non-nil fields only. email uniqueness is re-checked.
func (r *Repo) UpdateProfile(ctx context.Context, id string, req UpdateProfileRequest) (*User, error) {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET
		    name       = COALESCE($2, name),
		    email      = COALESCE($3, email),
		    avatar_url = COALESCE($4, avatar_url),
		    updated_at = NOW()
		WHERE id = $1
	`, id, req.Name, req.Email, req.AvatarURL)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *Repo) UpdatePasswordHash(ctx context.Context, id, hash string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1
	`, id, hash)
	return err
}

func (r *Repo) UpdateNotificationPrefs(ctx context.Context, id string, p NotificationPrefs) error {
	prefs, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE users SET notification_prefs = $2, updated_at = NOW() WHERE id = $1
	`, id, prefs)
	return err
}

func (r *Repo) queryOne(ctx context.Context, sql string, args ...any) (*User, error) {
	u := &User{}
	var prefs []byte
	err := r.pool.QueryRow(ctx, sql, args...).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.AvatarURL, &prefs, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := u.NotificationPrefs.UnmarshalJSONB(prefs); err != nil {
		return nil, err
	}
	return u, nil
}
