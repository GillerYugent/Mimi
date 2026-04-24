package docs

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var ErrValidation = errors.New("validation")

type Service struct {
	repo *Repo
}

func NewService(repo *Repo) *Service { return &Service{repo: repo} }

// Create: ровно один из projectId/mySpaceId обязателен — кроме случая,
// когда указан parentPageId (тогда scope наследуется у родителя).
func (s *Service) Create(ctx context.Context, creatorID string, req CreateRequest) (*Page, error) {
	if req.ParentPageID != nil {
		parent, err := s.repo.ByID(ctx, *req.ParentPageID)
		if err != nil {
			return nil, err
		}
		req.ProjectID = parent.ProjectID
		req.MySpaceID = parent.MySpaceID
	}
	if (req.ProjectID == nil) == (req.MySpaceID == nil) {
		return nil, fmt.Errorf("%w: требуется ровно один из projectId / mySpaceId", ErrValidation)
	}
	if req.Title == "" {
		req.Title = "Без названия"
	}
	return s.repo.Create(ctx, creatorID, req)
}

func (s *Service) Get(ctx context.Context, id string) (*Page, error) {
	return s.repo.ByID(ctx, id)
}

func (s *Service) RootPages(ctx context.Context, scope ScopeQuery) ([]Page, error) {
	if !scope.Valid() {
		return nil, fmt.Errorf("%w: требуется ровно один из projectId / mySpaceId", ErrValidation)
	}
	return s.repo.RootPages(ctx, scope)
}

func (s *Service) Children(ctx context.Context, parentID string) ([]Page, error) {
	if _, err := s.repo.ByID(ctx, parentID); err != nil {
		return nil, err
	}
	return s.repo.Children(ctx, parentID)
}

func (s *Service) Search(ctx context.Context, scope ScopeQuery, q string) ([]Page, error) {
	if !scope.Valid() {
		return nil, fmt.Errorf("%w: требуется ровно один из projectId / mySpaceId", ErrValidation)
	}
	q = strings.TrimSpace(q)
	if q == "" {
		return []Page{}, nil
	}
	return s.repo.Search(ctx, scope, q)
}

func (s *Service) Update(ctx context.Context, id string, req UpdateRequest) (*Page, error) {
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

// ─── Versions ─────────────────────────────────────────────────────

func (s *Service) SaveVersion(ctx context.Context, pageID, savedBy string) (*Version, error) {
	return s.repo.SaveVersion(ctx, pageID, savedBy)
}

func (s *Service) Versions(ctx context.Context, pageID string) ([]Version, error) {
	if _, err := s.repo.ByID(ctx, pageID); err != nil {
		return nil, err
	}
	return s.repo.VersionsByPage(ctx, pageID)
}

func (s *Service) RestoreVersion(ctx context.Context, versionID string) (*Page, error) {
	return s.repo.RestoreVersion(ctx, versionID)
}
