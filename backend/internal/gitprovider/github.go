package gitprovider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GitHub реализация Provider'а через REST v3.
// https://docs.github.com/en/rest
type GitHub struct {
	client *http.Client
	api    string // позволяет подменять для тестов; default: https://api.github.com
}

func NewGitHub() *GitHub {
	return &GitHub{
		client: &http.Client{Timeout: 10 * time.Second},
		api:    "https://api.github.com",
	}
}

func (g *GitHub) Name() string { return "github" }

type ghCommitResp struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
	Commit  struct {
		Message string `json:"message"`
		Author  struct {
			Name string    `json:"name"`
			Date time.Time `json:"date"`
		} `json:"author"`
	} `json:"commit"`
}

func (g *GitHub) FetchCommits(ctx context.Context, repoPath, token string, limit int) ([]Commit, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	url := fmt.Sprintf("%s/repos/%s/commits?per_page=%d", g.api, repoPath, limit)
	body, err := g.do(ctx, url, token)
	if err != nil {
		return nil, err
	}
	var raw []ghCommitResp
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	out := make([]Commit, 0, len(raw))
	for _, c := range raw {
		out = append(out, Commit{
			SHA:     c.SHA,
			Message: firstLine(c.Commit.Message),
			Author:  c.Commit.Author.Name,
			Date:    c.Commit.Author.Date,
			URL:     c.HTMLURL,
		})
	}
	return out, nil
}

type ghPRResp struct {
	Number    int       `json:"number"`
	Title     string    `json:"title"`
	HTMLURL   string    `json:"html_url"`
	State     string    `json:"state"`
	CreatedAt time.Time `json:"created_at"`
	User      struct {
		Login string `json:"login"`
	} `json:"user"`
}

func (g *GitHub) FetchPullRequests(ctx context.Context, repoPath, token string) ([]PullRequest, error) {
	url := fmt.Sprintf("%s/repos/%s/pulls?state=open&per_page=30", g.api, repoPath)
	body, err := g.do(ctx, url, token)
	if err != nil {
		return nil, err
	}
	var raw []ghPRResp
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	out := make([]PullRequest, 0, len(raw))
	for _, p := range raw {
		out = append(out, PullRequest{
			Number:    p.Number,
			Title:     p.Title,
			Author:    p.User.Login,
			Status:    p.State,
			URL:       p.HTMLURL,
			CreatedAt: p.CreatedAt,
		})
	}
	return out, nil
}

func (g *GitHub) do(ctx context.Context, url, token string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := g.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	switch resp.StatusCode {
	case http.StatusOK:
		return body, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, ErrUnauthorized
	case http.StatusNotFound:
		return nil, ErrNotFound
	default:
		return nil, fmt.Errorf("github api %d: %s", resp.StatusCode, string(body))
	}
}

func firstLine(s string) string {
	for i, r := range s {
		if r == '\n' {
			return s[:i]
		}
	}
	return s
}

// Защита от dead-code варнинга про errors.Is.
var _ = errors.Is
