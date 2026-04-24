package docs

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
	r = r.PathPrefix("/docs").Subrouter()
	r.Use(auth.Middleware(h.secret))

	r.HandleFunc("", h.list).Methods(http.MethodGet)
	r.HandleFunc("", h.create).Methods(http.MethodPost)
	r.HandleFunc("/search", h.search).Methods(http.MethodGet)
	r.HandleFunc("/{id}", h.get).Methods(http.MethodGet)
	r.HandleFunc("/{id}", h.update).Methods(http.MethodPatch)
	r.HandleFunc("/{id}", h.delete).Methods(http.MethodDelete)
	r.HandleFunc("/{id}/children", h.children).Methods(http.MethodGet)
	r.HandleFunc("/{id}/versions", h.versions).Methods(http.MethodGet)
	r.HandleFunc("/{id}/versions", h.saveVersion).Methods(http.MethodPost)
	r.HandleFunc("/versions/{versionId}/restore", h.restore).Methods(http.MethodPost)
}

func scope(r *http.Request) ScopeQuery {
	return ScopeQuery{
		ProjectID: r.URL.Query().Get("projectId"),
		MySpaceID: r.URL.Query().Get("mySpaceId"),
	}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	pages, err := h.svc.RootPages(r.Context(), scope(r))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, pages)
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
	p, err := h.svc.Get(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) children(w http.ResponseWriter, r *http.Request) {
	pages, err := h.svc.Children(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, pages)
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	pages, err := h.svc.Search(r.Context(), scope(r), q)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, pages)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var req UpdateRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	p, err := h.svc.Update(r.Context(), mux.Vars(r)["id"], req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), mux.Vars(r)["id"]); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) saveVersion(w http.ResponseWriter, r *http.Request) {
	v, err := h.svc.SaveVersion(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, v)
}

func (h *Handler) versions(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.Versions(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.RestoreVersion(r.Context(), mux.Vars(r)["versionId"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Страница не найдена")
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
