package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	r = r.PathPrefix("/notifications").Subrouter()

	// SSE-эндпоинт регистрируется ДО middleware Bearer'а: EventSource API в
	// браузере не умеет ставить Authorization-заголовок, поэтому токен
	// принимается через query (?token=...). Сами проверяем JWT внутри.
	r.HandleFunc("/stream", h.stream).Methods(http.MethodGet)

	// Остальные REST-эндпоинты требуют обычного Bearer'а.
	rest := r.PathPrefix("").Subrouter()
	rest.Use(auth.Middleware(h.secret))
	rest.HandleFunc("", h.list).Methods(http.MethodGet)
	rest.HandleFunc("", h.create).Methods(http.MethodPost)
	rest.HandleFunc("/unread-count", h.unreadCount).Methods(http.MethodGet)
	rest.HandleFunc("/read-all", h.markAllRead).Methods(http.MethodPost)
	rest.HandleFunc("/read", h.clearRead).Methods(http.MethodDelete)
	rest.HandleFunc("/{id}/read", h.markRead).Methods(http.MethodPost)
	rest.HandleFunc("/{id}", h.delete).Methods(http.MethodDelete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	list, err := h.svc.List(r.Context(), auth.UserID(r.Context()), limit)
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
	// Если userId не указан — публикуем уведомление текущему пользователю
	// (валидный кейс для локальных уведомлений типа "напоминание себе").
	if req.UserID == "" {
		req.UserID = auth.UserID(r.Context())
	}
	n, err := h.svc.Create(r.Context(), req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, n)
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	n, err := h.svc.UnreadCount(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]int{"count": n})
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.MarkRead(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.MarkAllRead(r.Context(), auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), mux.Vars(r)["id"], auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) clearRead(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.ClearRead(r.Context(), auth.UserID(r.Context())); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// stream — SSE-эндпоинт. Авторизация принимается двумя путями:
//   - Authorization: Bearer <token>   (curl, серверные клиенты)
//   - ?token=<token>                  (browser EventSource API)
func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authForSSE(r)
	if !ok {
		httpx.Err(w, http.StatusUnauthorized, "invalid_token", "Требуется access token")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.Err(w, http.StatusInternalServerError, "no_streaming", "Streaming не поддерживается")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering.

	// Подписываемся на in-process Hub.
	ch := h.svc.Hub().Subscribe(userID)
	defer h.svc.Hub().Unsubscribe(userID, ch)

	// Send initial comment to flush headers and confirm connection.
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-heartbeat.C:
			// Keep-alive: SSE-комментарий, который пройдёт через NGINX и не
			// триггерит обработчик на клиенте.
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case n, ok := <-ch:
			if !ok {
				return
			}
			b, err := json.Marshal(n)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: notification\ndata: %s\n\n", b)
			flusher.Flush()
		}
	}
}

func (h *Handler) authForSSE(r *http.Request) (string, bool) {
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		return "", false
	}
	claims, err := auth.Parse(h.secret, token)
	if err != nil || claims.Type != auth.AccessToken {
		return "", false
	}
	return claims.UserID, true
}

func writeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Err(w, http.StatusNotFound, "not_found", "Уведомление не найдено")
	case errors.Is(err, ErrValidation):
		httpx.Err(w, http.StatusBadRequest, "validation", err.Error())
	default:
		httpx.Err(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}

// Shut up "ctx unused" if some build tag disables the SSE flush path.
var _ = context.Background
