package users

import (
	"errors"
	"net/http"
	"strings"

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

// Register монтирует маршруты users-service под /users/*. Все маршруты
// требуют валидный access-токен: справочник пользователей не должен быть
// публичным даже по id.
func (h *Handler) Register(r *mux.Router) {
	protected := r.PathPrefix("/users").Subrouter()
	protected.Use(auth.Middleware(h.secret))

	protected.HandleFunc("/me/space", h.mySpace).Methods(http.MethodGet)
	protected.HandleFunc("/search", h.search).Methods(http.MethodGet)
	protected.HandleFunc("/batch", h.batch).Methods(http.MethodPost)
	protected.HandleFunc("/{id}", h.byID).Methods(http.MethodGet)
}

func (h *Handler) byID(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	u, err := h.svc.ByID(r.Context(), id)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, u)
}

func (h *Handler) batch(w http.ResponseWriter, r *http.Request) {
	var req BatchRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	users, err := h.svc.Batch(r.Context(), req.IDs)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, users)
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	users, err := h.svc.Search(r.Context(), q)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, users)
}

func (h *Handler) mySpace(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	ms, err := h.svc.MySpace(r.Context(), userID)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, ms)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Пользователь не найден")
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
