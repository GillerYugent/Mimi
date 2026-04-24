package docs

import (
	"encoding/json"
	"time"
)

// Blocks — непрозрачный JSON-массив блоков редактора. Сервер не парсит
// содержимое (конкретная схема блока — дело клиента); здесь достаточно
// передавать сырой json.RawMessage туда-обратно.
type Blocks json.RawMessage

func (b Blocks) MarshalJSON() ([]byte, error) {
	if len(b) == 0 {
		return []byte("[]"), nil
	}
	return []byte(b), nil
}

func (b *Blocks) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		*b = Blocks("[]")
		return nil
	}
	*b = append((*b)[:0], data...)
	return nil
}

type Page struct {
	ID           string     `json:"id"`
	ProjectID    *string    `json:"projectId,omitempty"`
	MySpaceID    *string    `json:"mySpaceId,omitempty"`
	ParentPageID *string    `json:"parentPageId,omitempty"`
	Title        string     `json:"title"`
	Icon         *string    `json:"icon,omitempty"`
	Blocks       Blocks     `json:"blocks"`
	CreatedBy    string     `json:"createdBy"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type Version struct {
	ID        string    `json:"id"`
	PageID    string    `json:"pageId"`
	Title     string    `json:"title"`
	Blocks    Blocks    `json:"blocks"`
	SavedBy   string    `json:"savedBy"`
	SavedAt   time.Time `json:"savedAt"`
}

type CreateRequest struct {
	ProjectID    *string `json:"projectId,omitempty"`
	MySpaceID    *string `json:"mySpaceId,omitempty"`
	ParentPageID *string `json:"parentPageId,omitempty"`
	Title        string  `json:"title"`
	Icon         *string `json:"icon,omitempty"`
	Blocks       Blocks  `json:"blocks,omitempty"`
}

type UpdateRequest struct {
	Title  *string `json:"title,omitempty"`
	Icon   *string `json:"icon,omitempty"`
	Blocks *Blocks `json:"blocks,omitempty"`
}

type ScopeQuery struct {
	ProjectID string
	MySpaceID string
}

func (s ScopeQuery) Valid() bool {
	// xor: ровно один из двух
	return (s.ProjectID != "") != (s.MySpaceID != "")
}
