package projects

import "time"

type ProjectStatus string

const (
	StatusActive   ProjectStatus = "active"
	StatusArchived ProjectStatus = "archived"
)

type Project struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	OwnerID     string        `json:"ownerId"`
	TeamID      *string       `json:"teamId,omitempty"`
	Status      ProjectStatus `json:"status"`
	Icon        string        `json:"icon"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

type CreateRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	TeamID      *string `json:"teamId,omitempty"`
}

type UpdateRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Icon        *string `json:"icon,omitempty"`
	TeamID      *string `json:"teamId,omitempty"`
}
