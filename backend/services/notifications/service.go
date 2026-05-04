package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/gilleryugent/mimi-backend/internal/events"
	"github.com/redis/go-redis/v9"
)

var ErrValidation = errors.New("validation")

type Service struct {
	repo *Repo
	hub  *Hub
}

func NewService(repo *Repo, hub *Hub) *Service { return &Service{repo: repo, hub: hub} }

func (s *Service) Create(ctx context.Context, req CreateRequest) (*Notification, error) {
	if req.UserID == "" {
		return nil, fmt.Errorf("%w: userId обязателен", ErrValidation)
	}
	if req.Type == "" {
		return nil, fmt.Errorf("%w: type обязателен", ErrValidation)
	}
	if strings.TrimSpace(req.Title) == "" {
		return nil, fmt.Errorf("%w: title обязателен", ErrValidation)
	}
	n := &Notification{
		UserID: req.UserID,
		Type:   req.Type,
		Title:  req.Title,
		Body:   req.Body,
		Link:   req.Link,
	}
	if err := s.repo.Create(ctx, n); err != nil {
		return nil, err
	}
	// Отправляем live-копию активным SSE-клиентам этого пользователя.
	s.hub.Broadcast(req.UserID, *n)
	return n, nil
}

func (s *Service) List(ctx context.Context, userID string, limit int) ([]Notification, error) {
	return s.repo.ListByUser(ctx, userID, limit)
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.UnreadCount(ctx, userID)
}

func (s *Service) MarkRead(ctx context.Context, id, userID string) error {
	return s.repo.MarkRead(ctx, id, userID)
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllRead(ctx, userID)
}

func (s *Service) Delete(ctx context.Context, id, userID string) error {
	return s.repo.Delete(ctx, id, userID)
}

func (s *Service) ClearRead(ctx context.Context, userID string) error {
	return s.repo.ClearRead(ctx, userID)
}

func (s *Service) Hub() *Hub { return s.hub }

// ─── Redis Pub/Sub consumer ──────────────────────────────────────

// StartTaskEventsConsumer подписывается на канал events.TaskChannel и для
// каждого события создаёт уведомление в БД + рассылает SSE-клиентам.
//
// Запускается в отдельной goroutine из main; блокируется до отмены ctx
// (graceful shutdown). Ошибки логируются и не прерывают цикл — по
// requirements ТЗ доставка уведомлений «best-effort».
func (s *Service) StartTaskEventsConsumer(ctx context.Context, rdb *redis.Client) {
	sub := rdb.Subscribe(ctx, events.TaskChannel)
	defer sub.Close()
	ch := sub.Channel()

	slog.Info("subscribed to redis channel", "channel", events.TaskChannel)

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			s.handleTaskEvent(ctx, msg.Payload)
		}
	}
}

// ─── Team events consumer ────────────────────────────────────────

// StartTeamEventsConsumer подписывается на events.TeamChannel, резолвит
// email → userID через auth-service (внутренний HTTP) и создаёт
// уведомление типа TypeTeamInvited.
func (s *Service) StartTeamEventsConsumer(ctx context.Context, rdb *redis.Client, authServiceURL string) {
	sub := rdb.Subscribe(ctx, events.TeamChannel)
	defer sub.Close()
	ch := sub.Channel()

	slog.Info("subscribed to redis channel", "channel", events.TeamChannel)

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			s.handleTeamEvent(ctx, msg.Payload, authServiceURL)
		}
	}
}

func (s *Service) handleTeamEvent(ctx context.Context, payload, authServiceURL string) {
	var e events.TeamInvitedEvent
	if err := json.Unmarshal([]byte(payload), &e); err != nil {
		slog.Warn("bad team event", "err", err)
		return
	}
	if e.Type != events.TeamInvited {
		return
	}

	// Резолвим email → userID через auth-service.
	userID, err := resolveUserByEmail(ctx, authServiceURL, e.Email)
	if err != nil {
		// Пользователя с таким email нет в системе — приглашение отправили
		// на внешний ящик; уведомление создавать не нужно.
		slog.Info("no user for invited email, skipping notification", "email", e.Email, "err", err)
		return
	}

	link := fmt.Sprintf("/invitations/%s/accept", e.InvitationID)
	if _, err := s.Create(ctx, CreateRequest{
		UserID: userID,
		Type:   TypeTeamInvited,
		Title:  fmt.Sprintf("Вас пригласили в команду «%s»", e.TeamName),
		Body:   "Нажмите «Принять», чтобы вступить в команду.",
		Link:   &link,
	}); err != nil {
		slog.Warn("create team_invited notification failed", "err", err)
	}
}

// resolveUserByEmail вызывает auth-service для поиска userID по email.
func resolveUserByEmail(ctx context.Context, authServiceURL, email string) (string, error) {
	u := authServiceURL + "/internal/users/by-email?email=" + url.QueryEscape(email)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return "", fmt.Errorf("user not found")
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("auth-service returned %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var result struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	return result.ID, nil
}

func (s *Service) handleTaskEvent(ctx context.Context, payload string) {
	var e events.TaskEvent
	if err := json.Unmarshal([]byte(payload), &e); err != nil {
		slog.Warn("bad task event", "err", err)
		return
	}
	if e.AssigneeID == "" {
		return // адресат не определён — игнорируем
	}

	var (
		title, body string
		nType       Type
	)
	switch e.Type {
	case events.TaskAssigned:
		nType = TypeTaskAssigned
		title = "Вам назначена задача"
		body = fmt.Sprintf("«%s»", e.Title)
	case events.TaskStatusChanged:
		nType = TypeTaskStatusChanged
		title = fmt.Sprintf("Статус задачи изменён: %s", e.Status)
		body = fmt.Sprintf("«%s»", e.Title)
	default:
		return
	}

	link := fmt.Sprintf("/project/%s", e.ProjectID)
	if _, err := s.Create(ctx, CreateRequest{
		UserID: e.AssigneeID,
		Type:   nType,
		Title:  title,
		Body:   body,
		Link:   &link,
	}); err != nil {
		slog.Warn("create notification failed", "err", err, "type", e.Type)
	}
}
