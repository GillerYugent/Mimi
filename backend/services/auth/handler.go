package auth

import (
	"errors"
	"net/http"

	"github.com/gilleryugent/mimi-backend/internal/auth"
	"github.com/gilleryugent/mimi-backend/internal/httpx"
	"github.com/gorilla/mux"
)

// Handler binds HTTP routes to the Service.
type Handler struct {
	svc    *Service
	secret []byte
}

func NewHandler(svc *Service, jwtSecret []byte) *Handler {
	return &Handler{svc: svc, secret: jwtSecret}
}

// Register attaches the auth-service routes to the given router. Public routes
// are under /auth/*; protected /auth/me/* requires a valid access token.
func (h *Handler) Register(r *mux.Router) {
	public := r.PathPrefix("/auth").Subrouter()
	public.HandleFunc("/register", h.register).Methods(http.MethodPost)
	public.HandleFunc("/login", h.login).Methods(http.MethodPost)
	public.HandleFunc("/refresh", h.refresh).Methods(http.MethodPost)
	public.HandleFunc("/logout", h.logout).Methods(http.MethodPost)

	protected := r.PathPrefix("/auth").Subrouter()
	protected.Use(auth.Middleware(h.secret))
	protected.HandleFunc("/me", h.me).Methods(http.MethodGet)
	protected.HandleFunc("/me", h.updateProfile).Methods(http.MethodPatch)
	protected.HandleFunc("/me/password", h.changePassword).Methods(http.MethodPost)
	protected.HandleFunc("/me/notifications", h.updateNotificationPrefs).Methods(http.MethodPatch)
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	res, err := h.svc.Register(r.Context(), req)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, res)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	res, err := h.svc.Login(r.Context(), req)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	res, err := h.svc.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	_ = h.svc.Logout(r.Context(), req.RefreshToken)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	u, err := h.svc.Me(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	var req UpdateProfileRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	u, err := h.svc.UpdateProfile(r.Context(), auth.UserID(r.Context()), req)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	var req ChangePasswordRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	if err := h.svc.ChangePassword(r.Context(), auth.UserID(r.Context()), req); err != nil {
		writeServiceErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) updateNotificationPrefs(w http.ResponseWriter, r *http.Request) {
	var req NotificationPrefs
	if !httpx.Decode(w, r, &req) {
		return
	}
	if err := h.svc.UpdateNotificationPrefs(r.Context(), auth.UserID(r.Context()), req); err != nil {
		writeServiceErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// writeServiceErr centralises mapping of domain errors to HTTP statuses.
func writeServiceErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrEmailTaken):
		httpx.Err(w, http.StatusConflict, "email_taken", "Email уже занят")
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Не найдено")
	case errors.Is(err, ErrInvalidCreds):
		httpx.Err(w, http.StatusUnauthorized, "invalid_credentials", "Неверный email или пароль")
	case errors.Is(err, ErrInvalidToken):
		httpx.Err(w, http.StatusUnauthorized, "invalid_refresh_token", "Недействительный refresh token")
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
