package tasks

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const selectColumns = `
    id, project_id, parent_task_id, title, description, status, priority,
    labels, assignee_id, deadline, commit_sha, pull_request_url,
    sort_order, created_by, created_at, updated_at
`

func scanTask(row pgx.Row, t *Task) error {
	return row.Scan(
		&t.ID, &t.ProjectID, &t.ParentTaskID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.Labels, &t.AssigneeID, &t.Deadline, &t.CommitSHA, &t.PullRequestURL,
		&t.SortOrder, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
	)
}

func (r *Repo) Create(ctx context.Context, creatorID string, req CreateRequest) (*Task, error) {
	t := &Task{}
	status := StatusBacklog
	if req.Status != nil {
		status = *req.Status
	}
	priority := PriorityMedium
	if req.Priority != nil {
		priority = *req.Priority
	}
	labels := req.Labels
	if labels == nil {
		labels = []string{}
	}
	var sortOrder int64
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	err := scanTask(r.pool.QueryRow(ctx, `
		INSERT INTO tasks (
		    project_id, parent_task_id, title, description, status, priority,
		    labels, assignee_id, deadline, commit_sha, pull_request_url,
		    sort_order, created_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		RETURNING `+selectColumns,
		req.ProjectID, req.ParentTaskID, req.Title, req.Description, status, priority,
		labels, req.AssigneeID, req.Deadline, req.CommitSHA, req.PullRequestURL,
		sortOrder, creatorID,
	), t)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Repo) ByID(ctx context.Context, id string) (*Task, error) {
	t := &Task{}
	err := scanTask(r.pool.QueryRow(ctx, `SELECT `+selectColumns+` FROM tasks WHERE id = $1`, id), t)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

// List собирает динамический SQL с фильтрами. Результаты отсортированы
// по sort_order ASC (порядок Kanban-колонки).
func (r *Repo) List(ctx context.Context, f ListFilters) ([]Task, error) {
	var (
		conds []string
		args  []any
	)
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.ProjectID != "" {
		conds = append(conds, "project_id = "+arg(f.ProjectID))
	}
	if !f.IncludeSubtasks {
		conds = append(conds, "parent_task_id IS NULL")
	}
	if f.Status != "" {
		conds = append(conds, "status = "+arg(f.Status))
	}
	if f.AssigneeID != "" {
		conds = append(conds, "assignee_id = "+arg(f.AssigneeID))
	}
	if f.Priority != "" {
		conds = append(conds, "priority = "+arg(f.Priority))
	}
	if f.Label != "" {
		conds = append(conds, arg(f.Label)+" = ANY (labels)")
	}
	if f.Search != "" {
		q := arg("%" + f.Search + "%")
		conds = append(conds, "(title ILIKE "+q+" OR description ILIKE "+q+")")
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	rows, err := r.pool.Query(ctx, `
		SELECT `+selectColumns+`
		FROM tasks `+where+`
		ORDER BY sort_order ASC, created_at ASC
		LIMIT 1000
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Task{}
	for rows.Next() {
		var t Task
		if err := scanTask(rows, &t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Update применяет частичное обновление. Для очистки nullable-полей (assignee,
// deadline) вызывающий ставит ClearAssignee/ClearDeadline — иначе nil в PATCH
// трактуется как «не трогать».
func (r *Repo) Update(ctx context.Context, id string, req UpdateRequest) (*Task, error) {
	var (
		sets []string
		args []any
	)
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if req.Title != nil {
		sets = append(sets, "title = "+arg(*req.Title))
	}
	if req.Description != nil {
		sets = append(sets, "description = "+arg(*req.Description))
	}
	if req.Status != nil {
		sets = append(sets, "status = "+arg(*req.Status))
	}
	if req.Priority != nil {
		sets = append(sets, "priority = "+arg(*req.Priority))
	}
	if req.Labels != nil {
		sets = append(sets, "labels = "+arg(*req.Labels))
	}
	if req.ClearAssignee {
		sets = append(sets, "assignee_id = NULL")
	} else if req.AssigneeID != nil {
		sets = append(sets, "assignee_id = "+arg(*req.AssigneeID))
	}
	if req.ClearDeadline {
		sets = append(sets, "deadline = NULL")
	} else if req.Deadline != nil {
		sets = append(sets, "deadline = "+arg(*req.Deadline))
	}
	if req.CommitSHA != nil {
		sets = append(sets, "commit_sha = "+arg(*req.CommitSHA))
	}
	if req.PullRequestURL != nil {
		sets = append(sets, "pull_request_url = "+arg(*req.PullRequestURL))
	}
	if req.SortOrder != nil {
		sets = append(sets, "sort_order = "+arg(*req.SortOrder))
	}

	if len(sets) == 0 {
		return r.ByID(ctx, id)
	}

	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	_, err := r.pool.Exec(ctx,
		"UPDATE tasks SET "+strings.Join(sets, ", ")+fmt.Sprintf(" WHERE id = $%d", len(args)),
		args...,
	)
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *Repo) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repo) Subtasks(ctx context.Context, parentID string) ([]Task, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+selectColumns+`
		FROM tasks WHERE parent_task_id = $1
		ORDER BY sort_order ASC, created_at ASC
	`, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Task{}
	for rows.Next() {
		var t Task
		if err := scanTask(rows, &t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *Repo) Stats(ctx context.Context, projectID string) (*Stats, error) {
	s := &Stats{}
	err := r.pool.QueryRow(ctx, `
		SELECT
		    COUNT(*) FILTER (WHERE parent_task_id IS NULL),
		    COUNT(*) FILTER (WHERE parent_task_id IS NULL AND status IN ('todo','in_progress','review')),
		    COUNT(*) FILTER (WHERE parent_task_id IS NULL AND status = 'done'),
		    COUNT(*) FILTER (WHERE parent_task_id IS NULL
		                     AND status <> 'done'
		                     AND deadline IS NOT NULL
		                     AND deadline < NOW())
		FROM tasks WHERE project_id = $1
	`, projectID).Scan(&s.Total, &s.InProgress, &s.Done, &s.Overdue)
	if err != nil {
		return nil, err
	}
	return s, nil
}
