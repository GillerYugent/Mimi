package projects

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// ListCacheTTL — 60 секунд. Соответствует НФТ «Кэширование» из практики 4:
// Redis TTL ≤ 60 с для часто запрашиваемых данных (Dashboard / список проектов).
const ListCacheTTL = 60 * time.Second

var ErrValidation = errors.New("validation")

type Service struct {
	repo     *Repo
	rdb      *redis.Client
	teamsURL string // base URL of teams-service for internal calls
}

func NewService(repo *Repo, rdb *redis.Client, teamsURL string) *Service {
	return &Service{repo: repo, rdb: rdb, teamsURL: teamsURL}
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

	// Получаем команды пользователя, чтобы включить проекты команд в список.
	teamIDs := s.fetchTeamIDs(ctx, ownerID)

	list, err := s.repo.ListByOwnerOrTeams(ctx, ownerID, teamIDs, status)
	if err != nil {
		return nil, err
	}
	if b, err := json.Marshal(list); err == nil {
		_ = s.rdb.Set(ctx, key, b, ListCacheTTL).Err()
	}
	return list, nil
}

// fetchTeamIDs calls teams-service (internal endpoint) to get the user's team IDs.
// Returns an empty slice on any error — the caller falls back to owner-only listing.
func (s *Service) fetchTeamIDs(ctx context.Context, userID string) []string {
	if s.teamsURL == "" {
		return nil
	}
	url := fmt.Sprintf("%s/internal/teams/user/%s", s.teamsURL, userID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		slog.Warn("fetchTeamIDs: build request", "err", err)
		return nil
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("fetchTeamIDs: call teams-service", "err", err)
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	var ids []string
	if err := json.Unmarshal(body, &ids); err != nil {
		return nil
	}
	return ids
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
