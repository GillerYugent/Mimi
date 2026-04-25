package git

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/gilleryugent/mimi-backend/internal/gitprovider"
	"github.com/redis/go-redis/v9"
)

const cacheTTL = 60 * time.Second

var ErrValidation = errors.New("validation")

type Service struct {
	repo      *Repo
	rdb       *redis.Client
	providers *gitprovider.Registry
}

func NewService(repo *Repo, rdb *redis.Client, providers *gitprovider.Registry) *Service {
	return &Service{repo: repo, rdb: rdb, providers: providers}
}

// Connect создаёт привязку. Перед сохранением проверяем, что репозиторий
// существует и провайдер отвечает (и токен, если задан, валидный).
// Это даёт пользователю быстрый фидбек на этапе подключения вместо
// тихой ошибки при первом просмотре коммитов.
func (s *Service) Connect(ctx context.Context, userID string, req ConnectRequest) (*Repository, error) {
	if req.ProjectID == "" {
		return nil, fmt.Errorf("%w: projectId обязателен", ErrValidation)
	}
	if req.RepoURL == "" {
		return nil, fmt.Errorf("%w: repoUrl обязателен", ErrValidation)
	}
	if req.Provider != ProviderGitHub && req.Provider != ProviderGitLab {
		return nil, fmt.Errorf("%w: provider должен быть github или gitlab", ErrValidation)
	}

	repoPath, err := gitprovider.ParseRepoPath(req.RepoURL)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err)
	}

	provider, err := s.providers.For(string(req.Provider))
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err)
	}

	// «Ping» — пробуем взять 1 коммит. Если репозиторий приватный без токена —
	// получим ErrUnauthorized; пользователь поймёт, что нужен PAT.
	if _, err := provider.FetchCommits(ctx, repoPath, req.AccessToken, 1); err != nil {
		return nil, err
	}

	rec, err := s.repo.Create(ctx, repoRecord{
		Repository: Repository{
			ProjectID:   req.ProjectID,
			Provider:    req.Provider,
			RepoURL:     req.RepoURL,
			RepoPath:    repoPath,
			ConnectedBy: userID,
		},
		AccessToken: req.AccessToken,
	})
	if err != nil {
		return nil, err
	}
	return &rec.Repository, nil
}

func (s *Service) ByID(ctx context.Context, id string) (*Repository, error) {
	rec, err := s.repo.ByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &rec.Repository, nil
}

func (s *Service) ByProject(ctx context.Context, projectID string) (*Repository, error) {
	rec, err := s.repo.ByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return &rec.Repository, nil
}

func (s *Service) Disconnect(ctx context.Context, id string) error {
	rec, err := s.repo.ByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	// Чистим связанные ключи кэша.
	_ = s.rdb.Del(ctx, commitsKey(id), prsKey(id)).Err()
	_ = rec
	return nil
}

// Commits / PullRequests с кэшем в Redis. Ключи привязаны к ID привязки,
// чтобы при отключении / переподключении старые данные не «тянулись».
func (s *Service) Commits(ctx context.Context, repoID string) ([]Commit, error) {
	if cached, err := s.rdb.Get(ctx, commitsKey(repoID)).Bytes(); err == nil && len(cached) > 0 {
		var out []Commit
		if err := json.Unmarshal(cached, &out); err == nil {
			return out, nil
		}
	}
	rec, err := s.repo.ByID(ctx, repoID)
	if err != nil {
		return nil, err
	}
	provider, err := s.providers.For(string(rec.Provider))
	if err != nil {
		return nil, err
	}
	raw, err := provider.FetchCommits(ctx, rec.RepoPath, rec.AccessToken, 30)
	if err != nil {
		return nil, err
	}
	out := make([]Commit, 0, len(raw))
	for _, c := range raw {
		out = append(out, Commit(c))
	}
	if b, err := json.Marshal(out); err == nil {
		_ = s.rdb.Set(ctx, commitsKey(repoID), b, cacheTTL).Err()
	}
	return out, nil
}

func (s *Service) PullRequests(ctx context.Context, repoID string) ([]PullRequest, error) {
	if cached, err := s.rdb.Get(ctx, prsKey(repoID)).Bytes(); err == nil && len(cached) > 0 {
		var out []PullRequest
		if err := json.Unmarshal(cached, &out); err == nil {
			return out, nil
		}
	}
	rec, err := s.repo.ByID(ctx, repoID)
	if err != nil {
		return nil, err
	}
	provider, err := s.providers.For(string(rec.Provider))
	if err != nil {
		return nil, err
	}
	raw, err := provider.FetchPullRequests(ctx, rec.RepoPath, rec.AccessToken)
	if err != nil {
		return nil, err
	}
	out := make([]PullRequest, 0, len(raw))
	for _, p := range raw {
		out = append(out, PullRequest(p))
	}
	if b, err := json.Marshal(out); err == nil {
		_ = s.rdb.Set(ctx, prsKey(repoID), b, cacheTTL).Err()
	}
	return out, nil
}

func commitsKey(id string) string { return "git:commits:" + id }
func prsKey(id string) string     { return "git:prs:" + id }
