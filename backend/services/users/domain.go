package users

import "time"

// PublicUser — профиль, который безопасно отдавать другим пользователям.
// Никаких password_hash / notification_prefs — эти поля остаются внутри
// auth-service.
type PublicUser struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	AvatarURL *string   `json:"avatarUrl,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// MySpace — личное пространство пользователя. Сервисы docs-service,
// tasks-service, boards-service сохраняют в своих таблицах привязку
// `my_space_id` вместо `project_id` для изолированных данных.
type MySpace struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
}

type BatchRequest struct {
	IDs []string `json:"ids"`
}
