package boards

import (
	"encoding/json"
	"time"
)

// Elements — непрозрачный JSON-массив элементов канваса (CanvasElement
// во фронтенде). Сервер не парсит схему конкретного элемента.
type Elements json.RawMessage

func (e Elements) MarshalJSON() ([]byte, error) {
	if len(e) == 0 {
		return []byte("[]"), nil
	}
	return []byte(e), nil
}

func (e *Elements) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		*e = Elements("[]")
		return nil
	}
	*e = append((*e)[:0], data...)
	return nil
}

type Canvas struct {
	ID        string    `json:"id"`
	ProjectID *string   `json:"projectId,omitempty"`
	MySpaceID *string   `json:"mySpaceId,omitempty"`
	Title     string    `json:"title"`
	Elements  Elements  `json:"elements"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	ProjectID *string  `json:"projectId,omitempty"`
	MySpaceID *string  `json:"mySpaceId,omitempty"`
	Title     string   `json:"title"`
	Elements  Elements `json:"elements,omitempty"`
}

type UpdateRequest struct {
	Title    *string   `json:"title,omitempty"`
	Elements *Elements `json:"elements,omitempty"`
}

type ScopeQuery struct {
	ProjectID string
	MySpaceID string
}

func (s ScopeQuery) Valid() bool {
	return (s.ProjectID != "") != (s.MySpaceID != "")
}
