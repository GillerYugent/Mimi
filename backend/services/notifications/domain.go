package notifications

import "time"

type Type string

const (
	TypeTaskAssigned       Type = "task_assigned"
	TypeTaskStatusChanged  Type = "task_status_changed"
	TypeTeamInvited        Type = "team_invited"
	TypeMentionedInDoc     Type = "mentioned_in_doc"
	TypeCommentAdded       Type = "comment_added"
)

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Type      Type      `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Link      *string   `json:"link,omitempty"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateRequest struct {
	UserID string  `json:"userId"`
	Type   Type    `json:"type"`
	Title  string  `json:"title"`
	Body   string  `json:"body,omitempty"`
	Link   *string `json:"link,omitempty"`
}
