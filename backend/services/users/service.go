package users

import (
	"context"
	"strings"
)

type Service struct {
	repo *Repo
}

func NewService(repo *Repo) *Service { return &Service{repo: repo} }

func (s *Service) ByID(ctx context.Context, id string) (*PublicUser, error) {
	return s.repo.ByID(ctx, id)
}

func (s *Service) Batch(ctx context.Context, ids []string) ([]PublicUser, error) {
	// Дедуплицируем и отфильтровываем пустые.
	seen := map[string]struct{}{}
	clean := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		clean = append(clean, id)
	}
	return s.repo.Batch(ctx, clean)
}

func (s *Service) Search(ctx context.Context, query string) ([]PublicUser, error) {
	return s.repo.Search(ctx, strings.TrimSpace(query))
}

func (s *Service) MySpace(ctx context.Context, userID string) (*MySpace, error) {
	return s.repo.GetOrCreateMySpace(ctx, userID)
}
