package gitprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// GitLab реализация Provider'а через REST v4.
// https://docs.gitlab.com/ee/api/
type GitLab struct {
	client *http.Client
	api    string // default: https://gitlab.com
}

func NewGitLab() *GitLab {
	return &GitLab{
		client: &http.Client{Timeout: 10 * time.Second},
		api:    "https://gitlab.com",
	}
}

func (g *GitLab) Name() string { return "gitlab" }

type glCommitResp struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Message    string    `json:"message"`
	AuthorName string    `json:"author_name"`
	CreatedAt  time.Time `json:"created_at"`
	WebURL     string    `json:"web_url"`
}

func (g *GitLab) FetchCommits(ctx context.Context, repoPath, token string, limit int) ([]Commit, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	encoded := url.PathEscape(repoPath)
	u := fmt.Sprintf("%s/api/v4/projects/%s/repository/commits?per_page=%d", g.api, encoded, limit)
	body, err := g.do(ctx, u, token)
	if err != nil {
		return nil, err
	}
	var raw []glCommitResp
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	out := make([]Commit, 0, len(raw))
	for _, c := range raw {
		message := c.Title
		if message == "" {
			message = firstLine(c.Message)
		}
		out = append(out, Commit{
			SHA:     c.ID,
			Message: message,
			Author:  c.AuthorName,
			Date:    c.CreatedAt,
			URL:     c.WebURL,
		})
	}
	return out, nil
}

type glMRResp struct {
	IID       int       `json:"iid"`
	Title     string    `json:"title"`
	State     string    `json:"state"`
	WebURL    string    `json:"web_url"`
	CreatedAt time.Time `json:"created_at"`
	Author    struct {
		Username string `json:"username"`
	} `json:"author"`
}

func (g *GitLab) FetchPullRequests(ctx context.Context, repoPath, token string) ([]PullRequest, error) {
	encoded := url.PathEscape(repoPath)
	u := fmt.Sprintf("%s/api/v4/projects/%s/merge_requests?state=opened&per_page=30", g.api, encoded)
	body, err := g.do(ctx, u, token)
	if err != nil {
		return nil, err
	}
	var raw []glMRResp
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	out := make([]PullRequest, 0, len(raw))
	for _, m := range raw {
		// Нормализуем "opened" → "open", чтобы фронт не различал диалекты.
		status := m.State
		if status == "opened" {
			status = "open"
		}
		out = append(out, PullRequest{
			Number:    m.IID,
			Title:     m.Title,
			Author:    m.Author.Username,
			Status:    status,
			URL:       m.WebURL,
			CreatedAt: m.CreatedAt,
		})
	}
	return out, nil
}

func (g *GitLab) do(ctx context.Context, url, token string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("PRIVATE-TOKEN", token)
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
		return nil, fmt.Errorf("gitlab api %d: %s", resp.StatusCode, string(body))
	}
}
