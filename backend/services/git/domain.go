package git

import "time"

type Provider string

const (
	ProviderGitHub Provider = "github"
	ProviderGitLab Provider = "gitlab"
)

type Repository struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Provider    Provider  `json:"provider"`
	RepoURL     string    `json:"repoUrl"`
	RepoPath    string    `json:"repoPath"`
	ConnectedBy string    `json:"connectedBy"`
	ConnectedAt time.Time `json:"connectedAt"`
	// AccessToken опускаем из JSON — секрет.
}

// Commit и PullRequest — нормализованные представления, одинаковые для
// обоих провайдеров. Это упрощает фронтенд: он рендерит одинаковую
// карточку независимо от github/gitlab.
type Commit struct {
	SHA     string    `json:"sha"`
	Message string    `json:"message"`
	Author  string    `json:"author"`
	Date    time.Time `json:"date"`
	URL     string    `json:"url"`
}

type PullRequest struct {
	Number    int       `json:"number"`
	Title     string    `json:"title"`
	Author    string    `json:"author"`
	Status    string    `json:"status"`
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"createdAt"`
}

type ConnectRequest struct {
	ProjectID   string   `json:"projectId"`
	Provider    Provider `json:"provider"`
	RepoURL     string   `json:"repoUrl"`
	AccessToken string   `json:"accessToken,omitempty"`
}
