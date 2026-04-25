package teams

import (
	"errors"
	"net/http"

	"github.com/gilleryugent/mimi-backend/internal/auth"
	"github.com/gilleryugent/mimi-backend/internal/httpx"
	"github.com/gorilla/mux"
)

type Handler struct {
	svc    *Service
	secret []byte
}

func NewHandler(svc *Service, jwtSecret []byte) *Handler {
	return &Handler{svc: svc, secret: jwtSecret}
}

func (h *Handler) Register(r *mux.Router) {
	teams := r.PathPrefix("/teams").Subrouter()
	teams.Use(auth.Middleware(h.secret))

	teams.HandleFunc("", h.listTeams).Methods(http.MethodGet)
	teams.HandleFunc("", h.createTeam).Methods(http.MethodPost)
	teams.HandleFunc("/{id}", h.getTeam).Methods(http.MethodGet)
	teams.HandleFunc("/{id}", h.renameTeam).Methods(http.MethodPatch)
	teams.HandleFunc("/{id}", h.deleteTeam).Methods(http.MethodDelete)

	teams.HandleFunc("/{id}/roles", h.listRoles).Methods(http.MethodGet)
	teams.HandleFunc("/{id}/roles", h.createRole).Methods(http.MethodPost)
	teams.HandleFunc("/roles/{roleId}", h.updateRole).Methods(http.MethodPatch)
	teams.HandleFunc("/roles/{roleId}", h.deleteRole).Methods(http.MethodDelete)

	teams.HandleFunc("/{id}/members", h.listMembers).Methods(http.MethodGet)
	teams.HandleFunc("/{id}/members/{userId}", h.setMemberRole).Methods(http.MethodPatch)
	teams.HandleFunc("/{id}/members/{userId}", h.removeMember).Methods(http.MethodDelete)

	teams.HandleFunc("/{id}/invitations", h.listInvitations).Methods(http.MethodGet)
	teams.HandleFunc("/{id}/invitations", h.invite).Methods(http.MethodPost)

	invs := r.PathPrefix("/invitations").Subrouter()
	invs.Use(auth.Middleware(h.secret))
	invs.HandleFunc("", h.pendingForEmail).Methods(http.MethodGet)
	invs.HandleFunc("/{id}/accept", h.accept).Methods(http.MethodPost)
	invs.HandleFunc("/{id}/decline", h.decline).Methods(http.MethodPost)
	invs.HandleFunc("/{id}", h.cancelInvitation).Methods(http.MethodDelete)
}

// ─── Teams ───────────────────────────────────────────────────────

func (h *Handler) createTeam(w http.ResponseWriter, r *http.Request) {
	var req CreateTeamRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	t, err := h.svc.CreateTeam(r.Context(), auth.UserID(r.Context()), req.Name)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, t)
}

func (h *Handler) listTeams(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.TeamsForUser(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) getTeam(w http.ResponseWriter, r *http.Request) {
	t, err := h.svc.Team(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) renameTeam(w http.ResponseWriter, r *http.Request) {
	var req RenameTeamRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	t, err := h.svc.RenameTeam(r.Context(), mux.Vars(r)["id"], req.Name, auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) deleteTeam(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteTeam(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Roles ───────────────────────────────────────────────────────

func (h *Handler) listRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.svc.Roles(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, roles)
}

func (h *Handler) createRole(w http.ResponseWriter, r *http.Request) {
	var req CreateRoleRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	role, err := h.svc.CreateRole(r.Context(), mux.Vars(r)["id"], req.Name, auth.UserID(r.Context()), req.Permissions)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, role)
}

func (h *Handler) updateRole(w http.ResponseWriter, r *http.Request) {
	var req UpdateRoleRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	role, err := h.svc.UpdateRole(r.Context(), mux.Vars(r)["roleId"], auth.UserID(r.Context()), req.Name, req.Permissions)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, role)
}

func (h *Handler) deleteRole(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteRole(r.Context(), mux.Vars(r)["roleId"], auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Members ─────────────────────────────────────────────────────

func (h *Handler) listMembers(w http.ResponseWriter, r *http.Request) {
	members, err := h.svc.Members(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, members)
}

func (h *Handler) setMemberRole(w http.ResponseWriter, r *http.Request) {
	var req SetMemberRoleRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	v := mux.Vars(r)
	m, err := h.svc.SetMemberRole(r.Context(), v["id"], v["userId"], auth.UserID(r.Context()), req.RoleID)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	if err := h.svc.RemoveMember(r.Context(), v["id"], v["userId"], auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Invitations ─────────────────────────────────────────────────

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	var req InviteRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	inv, err := h.svc.Invite(r.Context(), mux.Vars(r)["id"], req.Email, auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, inv)
}

func (h *Handler) listInvitations(w http.ResponseWriter, r *http.Request) {
	invs, err := h.svc.InvitationsForTeam(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, invs)
}

// pendingForEmail: GET /invitations?email=...
// Email передаётся клиентом (он знает свой email из /auth/me). MVP-trust:
// мы не верифицируем, что email действительно принадлежит вызывающему,
// т.к. для accept/decline проверяется отдельно.
func (h *Handler) pendingForEmail(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	invs, err := h.svc.PendingInvitationsForEmail(r.Context(), email)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, invs)
}

// accept / decline: email подаётся в query как и в pendingForEmail.
// Проверяется на соответствие email из приглашения.
func (h *Handler) accept(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if err := h.svc.AcceptInvitation(r.Context(), mux.Vars(r)["id"], email, auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) decline(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if err := h.svc.DeclineInvitation(r.Context(), mux.Vars(r)["id"], email); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) cancelInvitation(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.CancelInvitation(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Errors ──────────────────────────────────────────────────────

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Не найдено")
	case errors.Is(err, ErrForbidden):
		httpx.Err(w, http.StatusForbidden, "forbidden", "Недостаточно прав")
	case errors.Is(err, ErrConflict):
		httpx.Err(w, http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
