package teams

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrValidation = errors.New("validation")
	ErrForbidden  = errors.New("forbidden")
	ErrConflict   = errors.New("conflict")
)

type Service struct{ repo *Repo }

func NewService(repo *Repo) *Service { return &Service{repo: repo} }

// ─── Teams ───────────────────────────────────────────────────────

// CreateTeam создаёт команду, добавляет владельца как участника и засевает
// presets ролей (Backend / Frontend / Designer / QA).
func (s *Service) CreateTeam(ctx context.Context, ownerID, name string) (*Team, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: имя команды обязательно", ErrValidation)
	}
	t, err := s.repo.CreateTeam(ctx, name, ownerID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AddMember(ctx, t.ID, ownerID, nil); err != nil {
		return nil, err
	}
	for _, p := range PresetRoles {
		if _, err := s.repo.CreateRole(ctx, t.ID, p.Name, p.Permissions); err != nil {
			return nil, err
		}
	}
	return t, nil
}

func (s *Service) Team(ctx context.Context, id, requesterID string) (*Team, error) {
	t, err := s.repo.Team(ctx, id)
	if err != nil {
		return nil, err
	}
	if !s.canAccess(ctx, t, requesterID) {
		return nil, ErrForbidden
	}
	return t, nil
}

func (s *Service) TeamsForUser(ctx context.Context, userID string) ([]Team, error) {
	return s.repo.TeamsByUser(ctx, userID)
}

func (s *Service) RenameTeam(ctx context.Context, id, name, requesterID string) (*Team, error) {
	if err := s.requireOwner(ctx, id, requesterID); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: имя команды не может быть пустым", ErrValidation)
	}
	return s.repo.RenameTeam(ctx, id, name)
}

func (s *Service) DeleteTeam(ctx context.Context, id, requesterID string) error {
	if err := s.requireOwner(ctx, id, requesterID); err != nil {
		return err
	}
	return s.repo.DeleteTeam(ctx, id)
}

// ─── Roles ───────────────────────────────────────────────────────

func (s *Service) CreateRole(ctx context.Context, teamID, name, requesterID string, perms *Permissions) (*Role, error) {
	if err := s.requireOwner(ctx, teamID, requesterID); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: имя роли обязательно", ErrValidation)
	}
	p := DefaultPermissions()
	if perms != nil {
		p = *perms
	}
	return s.repo.CreateRole(ctx, teamID, name, p)
}

func (s *Service) Roles(ctx context.Context, teamID, requesterID string) ([]Role, error) {
	if _, err := s.Team(ctx, teamID, requesterID); err != nil {
		return nil, err
	}
	return s.repo.RolesByTeam(ctx, teamID)
}

func (s *Service) UpdateRole(ctx context.Context, roleID, requesterID string, name *string, perms *Permissions) (*Role, error) {
	role, err := s.repo.Role(ctx, roleID)
	if err != nil {
		return nil, err
	}
	if err := s.requireOwner(ctx, role.TeamID, requesterID); err != nil {
		return nil, err
	}
	if name != nil {
		v := strings.TrimSpace(*name)
		if v == "" {
			return nil, fmt.Errorf("%w: имя роли не может быть пустым", ErrValidation)
		}
		name = &v
	}
	return s.repo.UpdateRole(ctx, roleID, name, perms)
}

func (s *Service) DeleteRole(ctx context.Context, roleID, requesterID string) error {
	role, err := s.repo.Role(ctx, roleID)
	if err != nil {
		return err
	}
	if err := s.requireOwner(ctx, role.TeamID, requesterID); err != nil {
		return err
	}
	return s.repo.DeleteRole(ctx, roleID)
}

// ─── Members ─────────────────────────────────────────────────────

func (s *Service) Members(ctx context.Context, teamID, requesterID string) ([]Member, error) {
	if _, err := s.Team(ctx, teamID, requesterID); err != nil {
		return nil, err
	}
	return s.repo.MembersByTeam(ctx, teamID)
}

func (s *Service) SetMemberRole(ctx context.Context, teamID, userID, requesterID string, roleID *string) (*Member, error) {
	if err := s.requireOwner(ctx, teamID, requesterID); err != nil {
		return nil, err
	}
	t, err := s.repo.Team(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if userID == t.OwnerID {
		return nil, fmt.Errorf("%w: нельзя сменить роль владельца", ErrConflict)
	}
	if _, err := s.repo.Member(ctx, teamID, userID); err != nil {
		return nil, err
	}
	if err := s.repo.AddMember(ctx, teamID, userID, roleID); err != nil {
		return nil, err
	}
	return s.repo.Member(ctx, teamID, userID)
}

func (s *Service) RemoveMember(ctx context.Context, teamID, userID, requesterID string) error {
	t, err := s.repo.Team(ctx, teamID)
	if err != nil {
		return err
	}
	if userID == t.OwnerID {
		return fmt.Errorf("%w: нельзя исключить владельца", ErrConflict)
	}
	// Владелец может исключить любого; участник — только сам себя (выйти).
	if requesterID != t.OwnerID && requesterID != userID {
		return ErrForbidden
	}
	return s.repo.RemoveMember(ctx, teamID, userID)
}

// ─── Invitations ─────────────────────────────────────────────────

func (s *Service) Invite(ctx context.Context, teamID, email, requesterID string) (*Invitation, error) {
	if err := s.requireOwner(ctx, teamID, requesterID); err != nil {
		return nil, err
	}
	email = strings.TrimSpace(email)
	if email == "" {
		return nil, fmt.Errorf("%w: email обязателен", ErrValidation)
	}
	return s.repo.CreateInvitation(ctx, teamID, email, requesterID)
}

func (s *Service) InvitationsForTeam(ctx context.Context, teamID, requesterID string) ([]Invitation, error) {
	if _, err := s.Team(ctx, teamID, requesterID); err != nil {
		return nil, err
	}
	return s.repo.InvitationsByTeam(ctx, teamID)
}

func (s *Service) PendingInvitationsForEmail(ctx context.Context, email string) ([]Invitation, error) {
	if email == "" {
		return []Invitation{}, nil
	}
	return s.repo.PendingForEmail(ctx, email)
}

// AcceptInvitation: пользователь, чей email совпадает, становится участником
// команды. Email сравнивается case-insensitive.
func (s *Service) AcceptInvitation(ctx context.Context, invID, callerEmail, callerID string) error {
	inv, err := s.repo.Invitation(ctx, invID)
	if err != nil {
		return err
	}
	if inv.Status != InvitationPending {
		return fmt.Errorf("%w: invitation already %s", ErrConflict, inv.Status)
	}
	if !strings.EqualFold(inv.Email, callerEmail) {
		return ErrForbidden
	}
	if err := s.repo.AddMember(ctx, inv.TeamID, callerID, nil); err != nil {
		return err
	}
	return s.repo.UpdateInvitationStatus(ctx, invID, InvitationAccepted)
}

func (s *Service) DeclineInvitation(ctx context.Context, invID, callerEmail string) error {
	inv, err := s.repo.Invitation(ctx, invID)
	if err != nil {
		return err
	}
	if !strings.EqualFold(inv.Email, callerEmail) {
		return ErrForbidden
	}
	return s.repo.UpdateInvitationStatus(ctx, invID, InvitationDeclined)
}

func (s *Service) CancelInvitation(ctx context.Context, invID, requesterID string) error {
	inv, err := s.repo.Invitation(ctx, invID)
	if err != nil {
		return err
	}
	if err := s.requireOwner(ctx, inv.TeamID, requesterID); err != nil {
		return err
	}
	return s.repo.UpdateInvitationStatus(ctx, invID, InvitationCancelled)
}

// ─── Permission helpers ──────────────────────────────────────────

func (s *Service) requireOwner(ctx context.Context, teamID, requesterID string) error {
	t, err := s.repo.Team(ctx, teamID)
	if err != nil {
		return err
	}
	if t.OwnerID != requesterID {
		return ErrForbidden
	}
	return nil
}

// canAccess: владелец или участник.
func (s *Service) canAccess(ctx context.Context, t *Team, userID string) bool {
	if t.OwnerID == userID {
		return true
	}
	if _, err := s.repo.Member(ctx, t.ID, userID); err == nil {
		return true
	}
	return false
}
