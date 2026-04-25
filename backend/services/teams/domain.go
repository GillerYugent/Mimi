package teams

import (
	"encoding/json"
	"time"
)

// Permissions — флаги доступа роли. Зеркалит RolePermissions во фронтенде.
type Permissions struct {
	CanViewDocs    bool `json:"canViewDocs"`
	CanEditDocs    bool `json:"canEditDocs"`
	CanViewTasks   bool `json:"canViewTasks"`
	CanEditTasks   bool `json:"canEditTasks"`
	CanViewBoards  bool `json:"canViewBoards"`
	CanEditBoards  bool `json:"canEditBoards"`
	CanManageTeam  bool `json:"canManageTeam"`
}

// DefaultPermissions — с теми же значениями, что и DEFAULT в SQL-миграции.
func DefaultPermissions() Permissions {
	return Permissions{
		CanViewDocs:   true,
		CanEditDocs:   true,
		CanViewTasks:  true,
		CanEditTasks:  true,
		CanViewBoards: true,
		CanEditBoards: true,
		CanManageTeam: false,
	}
}

func (p Permissions) ToJSONB() ([]byte, error) { return json.Marshal(p) }

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OwnerID   string    `json:"ownerId"`
	CreatedAt time.Time `json:"createdAt"`
}

type Role struct {
	ID          string      `json:"id"`
	TeamID      string      `json:"teamId"`
	Name        string      `json:"name"`
	Permissions Permissions `json:"permissions"`
}

type Member struct {
	TeamID   string    `json:"teamId"`
	UserID   string    `json:"userId"`
	RoleID   *string   `json:"roleId,omitempty"`
	JoinedAt time.Time `json:"joinedAt"`
}

type InvitationStatus string

const (
	InvitationPending   InvitationStatus = "pending"
	InvitationAccepted  InvitationStatus = "accepted"
	InvitationDeclined  InvitationStatus = "declined"
	InvitationCancelled InvitationStatus = "cancelled"
)

type Invitation struct {
	ID        string           `json:"id"`
	TeamID    string           `json:"teamId"`
	Email     string           `json:"email"`
	Status    InvitationStatus `json:"status"`
	InvitedBy string           `json:"invitedBy"`
	CreatedAt time.Time        `json:"createdAt"`
}

// ─── Requests ────────────────────────────────────────────────────

type CreateTeamRequest struct {
	Name string `json:"name"`
}

type RenameTeamRequest struct {
	Name string `json:"name"`
}

type CreateRoleRequest struct {
	Name        string       `json:"name"`
	Permissions *Permissions `json:"permissions,omitempty"`
}

type UpdateRoleRequest struct {
	Name        *string      `json:"name,omitempty"`
	Permissions *Permissions `json:"permissions,omitempty"`
}

type SetMemberRoleRequest struct {
	RoleID *string `json:"roleId"`
}

type InviteRequest struct {
	Email string `json:"email"`
}

// PRESET_ROLES — создаются автоматически при создании команды.
// Список соответствует фронтенд-присетам в teamStore.
var PresetRoles = []struct {
	Name        string
	Permissions Permissions
}{
	{Name: "Backend", Permissions: DefaultPermissions()},
	{Name: "Frontend", Permissions: DefaultPermissions()},
	{Name: "Designer", Permissions: func() Permissions { p := DefaultPermissions(); p.CanEditTasks = false; return p }()},
	{Name: "QA", Permissions: func() Permissions {
		p := DefaultPermissions()
		p.CanEditDocs = false
		p.CanEditBoards = false
		return p
	}()},
}
