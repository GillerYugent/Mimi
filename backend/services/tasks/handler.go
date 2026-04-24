package tasks

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
	r = r.PathPrefix("/tasks").Subrouter()
	r.Use(auth.Middleware(h.secret))

	r.HandleFunc("", h.list).Methods(http.MethodGet)
	r.HandleFunc("", h.create).Methods(http.MethodPost)
	r.HandleFunc("/stats", h.stats).Methods(http.MethodGet)
	r.HandleFunc("/{id}", h.get).Methods(http.MethodGet)
	r.HandleFunc("/{id}", h.update).Methods(http.MethodPatch)
	r.HandleFunc("/{id}", h.delete).Methods(http.MethodDelete)
	r.HandleFunc("/{id}/subtasks", h.subtasks).Methods(http.MethodGet)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := ListFilters{
		ProjectID:       q.Get("projectId"),
		Status:          TaskStatus(q.Get("status")),
		AssigneeID:      q.Get("assigneeId"),
		Label:           q.Get("label"),
		Priority:        TaskPriority(q.Get("priority")),
		Search:          q.Get("search"),
		IncludeSubtasks: q.Get("includeSubtasks") == "true",
	}
	list, err := h.svc.List(r.Context(), f)
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
	t, err := h.svc.Create(r.Context(), auth.UserID(r.Context()), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, t)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	t, err := h.svc.Get(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var req UpdateRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	t, err := h.svc.Update(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context()), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), mux.Vars(r)["id"]); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) subtasks(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.Subtasks(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("projectId")
	s, err := h.svc.Stats(r.Context(), projectID)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Задача не найдена")
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
