package tasks

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/gilleryugent/mimi-backend/internal/events"
	"github.com/redis/go-redis/v9"
)

var ErrValidation = errors.New("validation")

type Service struct {
	repo *Repo
	rdb  *redis.Client
}

func NewService(repo *Repo, rdb *redis.Client) *Service {
	return &Service{repo: repo, rdb: rdb}
}

func (s *Service) Create(ctx context.Context, creatorID string, req CreateRequest) (*Task, error) {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, fmt.Errorf("%w: поле title обязательно", ErrValidation)
	}
	if req.ProjectID == "" {
		return nil, fmt.Errorf("%w: projectId обязателен", ErrValidation)
	}
	t, err := s.repo.Create(ctx, creatorID, req)
	if err != nil {
		return nil, err
	}

	// При создании задачи сразу с assignee — тоже уведомление.
	if t.AssigneeID != nil && *t.AssigneeID != creatorID {
		s.publish(ctx, events.TaskEvent{
			Type:       events.TaskAssigned,
			TaskID:     t.ID,
			ProjectID:  t.ProjectID,
			Title:      t.Title,
			AssigneeID: *t.AssigneeID,
			ActorID:    creatorID,
		})
	}
	return t, nil
}

func (s *Service) Get(ctx context.Context, id string) (*Task, error) {
	return s.repo.ByID(ctx, id)
}

func (s *Service) List(ctx context.Context, f ListFilters) ([]Task, error) {
	return s.repo.List(ctx, f)
}

func (s *Service) Subtasks(ctx context.Context, parentID string) ([]Task, error) {
	if _, err := s.repo.ByID(ctx, parentID); err != nil {
		return nil, err
	}
	return s.repo.Subtasks(ctx, parentID)
}

func (s *Service) Update(ctx context.Context, id, actorID string, req UpdateRequest) (*Task, error) {
	prev, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			return nil, fmt.Errorf("%w: title не может быть пустым", ErrValidation)
		}
		req.Title = &t
	}

	next, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}

	// 1. Смена исполнителя → уведомление новому assignee.
	if !sameStringPtr(prev.AssigneeID, next.AssigneeID) {
		if next.AssigneeID != nil && *next.AssigneeID != actorID {
			s.publish(ctx, events.TaskEvent{
				Type:       events.TaskAssigned,
				TaskID:     next.ID,
				ProjectID:  next.ProjectID,
				Title:      next.Title,
				AssigneeID: *next.AssigneeID,
				ActorID:    actorID,
			})
		}
	}

	// 2. Смена статуса → уведомление текущему исполнителю (если не сам).
	if prev.Status != next.Status && next.AssigneeID != nil && *next.AssigneeID != actorID {
		s.publish(ctx, events.TaskEvent{
			Type:       events.TaskStatusChanged,
			TaskID:     next.ID,
			ProjectID:  next.ProjectID,
			Title:      next.Title,
			Status:     string(next.Status),
			PrevStatus: string(prev.Status),
			AssigneeID: *next.AssigneeID,
			ActorID:    actorID,
		})
	}
	return next, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) Stats(ctx context.Context, projectID string) (*Stats, error) {
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId обязателен", ErrValidation)
	}
	return s.repo.Stats(ctx, projectID)
}

// publish — отдельный метод, чтобы ошибки Redis не ломали основной путь
// выполнения. Достаточно лога: доставка уведомления best-effort.
func (s *Service) publish(ctx context.Context, e events.TaskEvent) {
	if err := events.Publish(ctx, s.rdb, e); err != nil {
		slog.Warn("publish task event failed", "err", err, "type", e.Type)
	}
}

func sameStringPtr(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}
