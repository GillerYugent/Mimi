package notifications

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const cols = `id, user_id, type, title, body, link, is_read, created_at`

func scan(row pgx.Row, n *Notification) error {
	return row.Scan(
		&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.Link, &n.IsRead, &n.CreatedAt,
	)
}

func (r *Repo) Create(ctx context.Context, n *Notification) error {
	return scan(r.pool.QueryRow(ctx, `
		INSERT INTO notifications (user_id, type, title, body, link)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+cols,
		n.UserID, n.Type, n.Title, n.Body, n.Link,
	), n)
}

func (r *Repo) ListByUser(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT `+cols+`
		FROM notifications WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Notification{}
	for rows.Next() {
		var n Notification
		if err := scan(rows, &n); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *Repo) UnreadCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE
	`, userID).Scan(&n)
	return n, err
}

func (r *Repo) MarkRead(ctx context.Context, id, userID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE
	`, userID)
	return err
}

func (r *Repo) Delete(ctx context.Context, id, userID string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM notifications WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ClearRead удаляет все прочитанные уведомления пользователя.
func (r *Repo) ClearRead(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE`, userID)
	return err
}
