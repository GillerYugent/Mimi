package auth

import (
	"encoding/json"
	"time"
)

// NotificationPrefs is stored as JSONB in the `users` table. The keys mirror
// the frontend's `NotificationPrefs` type so the API body maps one-to-one.
type NotificationPrefs struct {
	TaskAssigned       bool `json:"taskAssigned"`
	TaskStatusChanged  bool `json:"taskStatusChanged"`
	TeamInvited        bool `json:"teamInvited"`
	MentionedInDoc     bool `json:"mentionedInDoc"`
}

// User is the DB row. passwordHash is deliberately unexported-in-JSON via `-`
// tag so it never leaks through the API.
type User struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	Email             string            `json:"email"`
	PasswordHash      string            `json:"-"`
	AvatarURL         *string           `json:"avatarUrl,omitempty"`
	NotificationPrefs NotificationPrefs `json:"notificationPrefs"`
	CreatedAt         time.Time         `json:"createdAt"`
	UpdatedAt         time.Time         `json:"updatedAt"`
}

// DTO requests / responses

type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type ChangePasswordRequest struct {
	Current string `json:"current"`
	Next    string `json:"next"`
}

type UpdateProfileRequest struct {
	Name      *string `json:"name,omitempty"`
	Email     *string `json:"email,omitempty"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	User         *User  `json:"user"`
}

// DefaultPrefs is used when creating a brand new user via register.
func DefaultPrefs() NotificationPrefs {
	return NotificationPrefs{
		TaskAssigned:      true,
		TaskStatusChanged: true,
		TeamInvited:       true,
		MentionedInDoc:    true,
	}
}

// Helpers for JSON <-> JSONB round-trip via pgx.
func (p NotificationPrefs) MarshalJSONB() ([]byte, error) { return json.Marshal(p) }
func (p *NotificationPrefs) UnmarshalJSONB(b []byte) error {
	if len(b) == 0 {
		*p = DefaultPrefs()
		return nil
	}
	return json.Unmarshal(b, p)
}
