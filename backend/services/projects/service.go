package projects

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// ListCacheTTL — 60 секунд. Соответствует НФТ «Кэширование» из практики 4:
// Redis TTL ≤ 60 с для часто запрашиваемых данных (Dashboard / список проектов).
const ListCacheTTL = 60 * time.Second

var ErrValidation = errors.New("validation")

type Service struct {
	repo *Repo
	rdb  *redis.Client
}

func NewService(repo *Repo, rdb *redis.Client) *Service {
	return &Service{repo: repo, rdb: rdb}
}

// ─── Create ──────────────────────────────────────────────────────

func (s *Service) Create(ctx context.Context, ownerID string, req CreateRequest) (*Project, error) {
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return nil, fmt.Errorf("%w: title required", ErrValidation)
	}
	p, err := s.repo.Create(ctx, ownerID, req)
	if err != nil {
		return nil, err
	}
	s.invalidateList(ctx, ownerID)
	return p, nil
}

// ─── Read ────────────────────────────────────────────────────────

func (s *Service) Get(ctx context.Context, id, userID string) (*Project, error) {
	p, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.OwnerID != userID {
		return nil, ErrForbidden
	}
	return p, nil
}

// List — с кэшем в Redis. Ключ уникален по (userID, status).
func (s *Service) List(ctx context.Context, ownerID string, status ProjectStatus) ([]Project, error) {
	if status != StatusActive && status != StatusArchived {
		status = StatusActive
	}
	key := listCacheKey(ownerID, status)

	if cached, err := s.rdb.Get(ctx, key).Bytes(); err == nil && len(cached) > 0 {
		var out []Project
		if err := json.Unmarshal(cached, &out); err == nil {
			return out, nil
		}
	}

	list, err := s.repo.ListByOwner(ctx, ownerID, status)
	if err != nil {
		return nil, err
	}
	if b, err := json.Marshal(list); err == nil {
		_ = s.rdb.Set(ctx, key, b, ListCacheTTL).Err()
	}
	return list, nil
}

// ─── Mutations ───────────────────────────────────────────────────

func (s *Service) Update(ctx context.Context, id, userID string, req UpdateRequest) (*Project, error) {
	existing, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing.OwnerID != userID {
		return nil, ErrForbidden
	}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			return nil, fmt.Errorf("%w: title cannot be empty", ErrValidation)
		}
		req.Title = &t
	}
	p, err := s.repo.Update(ctx, id, req)
	if err != nil {
		return nil, err
	}
	s.invalidateList(ctx, userID)
	return p, nil
}

func (s *Service) Archive(ctx context.Context, id, userID string) (*Project, error) {
	return s.setStatus(ctx, id, userID, StatusArchived)
}

func (s *Service) Restore(ctx context.Context, id, userID string) (*Project, error) {
	return s.setStatus(ctx, id, userID, StatusActive)
}

func (s *Service) setStatus(ctx context.Context, id, userID string, status ProjectStatus) (*Project, error) {
	existing, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing.OwnerID != userID {
		return nil, ErrForbidden
	}
	p, err := s.repo.SetStatus(ctx, id, status)
	if err != nil {
		return nil, err
	}
	s.invalidateList(ctx, userID)
	return p, nil
}

func (s *Service) Delete(ctx context.Context, id, userID string) error {
	existing, err := s.repo.ByID(ctx, id)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return ErrForbidden
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	s.invalidateList(ctx, userID)
	return nil
}

// ─── Cache helpers ───────────────────────────────────────────────

func listCacheKey(userID string, status ProjectStatus) string {
	return fmt.Sprintf("projects:list:%s:%s", userID, status)
}

// invalidateList удаляет оба варианта кэша (active/archived) для пользователя.
// Любая мутация проекта вытесняет кэш в ту же транзакцию — следующий GET
// прогреет его заново.
func (s *Service) invalidateList(ctx context.Context, userID string) {
	_ = s.rdb.Del(ctx,
		listCacheKey(userID, StatusActive),
		listCacheKey(userID, StatusArchived),
	).Err()
}
