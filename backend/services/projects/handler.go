package projects

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
	r = r.PathPrefix("/projects").Subrouter()
	r.Use(auth.Middleware(h.secret))

	r.HandleFunc("", h.list).Methods(http.MethodGet)
	r.HandleFunc("", h.create).Methods(http.MethodPost)
	r.HandleFunc("/{id}", h.get).Methods(http.MethodGet)
	r.HandleFunc("/{id}", h.update).Methods(http.MethodPatch)
	r.HandleFunc("/{id}", h.delete).Methods(http.MethodDelete)
	r.HandleFunc("/{id}/archive", h.archive).Methods(http.MethodPost)
	r.HandleFunc("/{id}/restore", h.restore).Methods(http.MethodPost)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	status := ProjectStatus(r.URL.Query().Get("status"))
	if status == "" {
		status = StatusActive
	}
	list, err := h.svc.List(r.Context(), userID, status)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	p, err := h.svc.Create(r.Context(), auth.UserID(r.Context()), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	p, err := h.svc.Get(r.Context(), id, auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var req UpdateRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	p, err := h.svc.Update(r.Context(), id, auth.UserID(r.Context()), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if err := h.svc.Delete(r.Context(), id, auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) archive(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	p, err := h.svc.Archive(r.Context(), id, auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	p, err := h.svc.Restore(r.Context(), id, auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Проект не найден")
	case errors.Is(err, ErrForbidden):
		httpx.Err(w, http.StatusForbidden, "forbidden", "Нет доступа к проекту")
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
