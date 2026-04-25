// Package gitprovider абстрагирует обращения к API внешних Git-хостингов
// (GitHub, GitLab). Контракт минимальный — только то, что использует
// фронтенд: список коммитов и список открытых pull / merge requests.
//
// Каждая реализация принимает на вход repoPath (owner/repo для GitHub,
// namespace/project для GitLab) и опциональный токен (PAT).
package gitprovider

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrNotFound     = errors.New("repo not found")
	ErrUnsupported  = errors.New("unsupported provider")
)

type Commit struct {
	SHA     string
	Message string
	Author  string
	Date    time.Time
	URL     string
}

type PullRequest struct {
	Number    int
	Title     string
	Author    string
	Status    string // open | merged | closed
	URL       string
	CreatedAt time.Time
}

// Provider — общий контракт.
type Provider interface {
	Name() string
	FetchCommits(ctx context.Context, repoPath, token string, limit int) ([]Commit, error)
	FetchPullRequests(ctx context.Context, repoPath, token string) ([]PullRequest, error)
}

// ParseRepoPath извлекает "owner/repo" / "namespace/project" из URL.
// Поддерживает https и ssh-стиль формы.
//
// Примеры:
//   https://github.com/GillerYugent/Mimi          -> "GillerYugent/Mimi"
//   https://github.com/GillerYugent/Mimi.git     -> "GillerYugent/Mimi"
//   git@github.com:GillerYugent/Mimi.git         -> "GillerYugent/Mimi"
//   https://gitlab.com/group/sub/project          -> "group/sub/project"
func ParseRepoPath(rawURL string) (string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return "", fmt.Errorf("empty url")
	}

	// SSH-стиль: git@host:path.git
	if strings.HasPrefix(rawURL, "git@") {
		parts := strings.SplitN(rawURL, ":", 2)
		if len(parts) != 2 {
			return "", fmt.Errorf("invalid ssh url")
		}
		return cleanRepoPath(parts[1]), nil
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	return cleanRepoPath(u.Path), nil
}

func cleanRepoPath(p string) string {
	p = strings.TrimPrefix(p, "/")
	p = strings.TrimSuffix(p, ".git")
	p = strings.Trim(p, "/")
	return p
}
