package git

import (
	"errors"
	"net/http"

	"github.com/gilleryugent/mimi-backend/internal/auth"
	"github.com/gilleryugent/mimi-backend/internal/gitprovider"
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
	r = r.PathPrefix("/git").Subrouter()
	r.Use(auth.Middleware(h.secret))

	r.HandleFunc("/repositories", h.connect).Methods(http.MethodPost)
	r.HandleFunc("/repositories", h.byProject).Methods(http.MethodGet)
	r.HandleFunc("/repositories/{id}", h.get).Methods(http.MethodGet)
	r.HandleFunc("/repositories/{id}", h.disconnect).Methods(http.MethodDelete)
	r.HandleFunc("/repositories/{id}/commits", h.commits).Methods(http.MethodGet)
	r.HandleFunc("/repositories/{id}/pull-requests", h.pullRequests).Methods(http.MethodGet)
}

func (h *Handler) connect(w http.ResponseWriter, r *http.Request) {
	var req ConnectRequest
	if !httpx.Decode(w, r, &req) {
		return
	}
	rec, err := h.svc.Connect(r.Context(), auth.UserID(r.Context()), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, rec)
}

func (h *Handler) byProject(w http.ResponseWriter, r *http.Request) {
	pid := r.URL.Query().Get("projectId")
	if pid == "" {
		httpx.Err(w, http.StatusBadRequest, "validation", "projectId обязателен")
		return
	}
	rec, err := h.svc.ByProject(r.Context(), pid)
	if err != nil {
		// Если привязки нет — возвращаем 200 с null, чтобы фронту было удобнее
		// не различать «нет данных» и «404 — нет смысла рендерить».
		if errors.Is(err, ErrNotFound) {
			httpx.JSON(w, http.StatusOK, nil)
			return
		}
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rec)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	rec, err := h.svc.ByID(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rec)
}

func (h *Handler) disconnect(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Disconnect(r.Context(), mux.Vars(r)["id"]); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) commits(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.Commits(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) pullRequests(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.PullRequests(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Репозиторий не найден")
	case errors.Is(err, ErrAlreadyExists):
		httpx.Err(w, http.StatusConflict, "conflict", "Репозиторий уже подключён к этому проекту")
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	case errors.Is(err, gitprovider.ErrUnauthorized):
		httpx.Err(w, http.StatusUnauthorized, "git_unauthorized", "Не удалось авторизоваться у провайдера; нужен access token")
	case errors.Is(err, gitprovider.ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "git_not_found", "Репозиторий не найден у провайдера или нет доступа")
	case errors.Is(err, gitprovider.ErrUnsupported):
		httpx.Err(w, http.StatusBadRequest, "validation", "Неподдерживаемый провайдер")
	default:
		httpx.Err(w, http.StatusBadGateway, "git_provider_error", err.Error())
	}
}
