package boards

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var ErrValidation = errors.New("validation")

type Service struct{ repo *Repo }

func NewService(repo *Repo) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, creatorID string, req CreateRequest) (*Canvas, error) {
	if (req.ProjectID == nil) == (req.MySpaceID == nil) {
		return nil, fmt.Errorf("%w: требуется ровно один из projectId / mySpaceId", ErrValidation)
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		req.Title = "Новый канвас"
	}
	return s.repo.Create(ctx, creatorID, req)
}

func (s *Service) Get(ctx context.Context, id string) (*Canvas, error) {
	return s.repo.ByID(ctx, id)
}

func (s *Service) List(ctx context.Context, scope ScopeQuery) ([]Canvas, error) {
	if !scope.Valid() {
		return nil, fmt.Errorf("%w: требуется ровно один из projectId / mySpaceId", ErrValidation)
	}
	return s.repo.List(ctx, scope)
}

func (s *Service) Update(ctx context.Context, id string, req UpdateRequest) (*Canvas, error) {
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			t = "Без названия"
		}
		req.Title = &t
	}
	return s.repo.Update(ctx, id, req)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
