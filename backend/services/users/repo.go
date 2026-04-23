package users

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

// ByID читает публичный профиль из общей с auth-service таблицы `users`.
// password_hash и notification_prefs не выбираем.
func (r *Repo) ByID(ctx context.Context, id string) (*PublicUser, error) {
	u := &PublicUser{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, email, avatar_url, created_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Name, &u.Email, &u.AvatarURL, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// Batch — массовое получение по списку id. Используется фронтендом для
// подсветки исполнителей задач / членов команды одним запросом.
func (r *Repo) Batch(ctx context.Context, ids []string) ([]PublicUser, error) {
	if len(ids) == 0 {
		return []PublicUser{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, email, avatar_url, created_at
		FROM users WHERE id = ANY($1::uuid[])
	`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]PublicUser, 0, len(ids))
	for rows.Next() {
		var u PublicUser
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.AvatarURL, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// Search — поиск пользователей по email prefix (для flow приглашения в команду).
// Limit 20 исключает потенциальную энумерацию аккаунтов в мусорном трафике.
func (r *Repo) Search(ctx context.Context, query string) ([]PublicUser, error) {
	if query == "" {
		return []PublicUser{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, email, avatar_url, created_at
		FROM users
		WHERE LOWER(email) LIKE LOWER($1) || '%'
		ORDER BY email
		LIMIT 20
	`, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PublicUser{}
	for rows.Next() {
		var u PublicUser
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.AvatarURL, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// GetOrCreateMySpace — возвращает MySpace пользователя, создавая при
// первом обращении. ON CONFLICT DO NOTHING гарантирует идемпотентность.
func (r *Repo) GetOrCreateMySpace(ctx context.Context, userID string) (*MySpace, error) {
	ms := &MySpace{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO my_spaces (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
		RETURNING id, user_id, created_at
	`, userID).Scan(&ms.ID, &ms.UserID, &ms.CreatedAt)
	if err != nil {
		return nil, err
	}
	return ms, nil
}
