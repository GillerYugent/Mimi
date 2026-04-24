// Package events содержит контракты асинхронных событий, которыми обмениваются
// микросервисы Mimi через Redis Pub/Sub.
//
// Сервис-источник (например, tasks-service при изменении assignee или
// статуса) публикует событие в свой канал. notifications-service слушает
// каналы и формирует уведомления — ровно так описано в архитектуре
// из практики 7 («notifications-service → SSE / Redis Pub/Sub»).
package events

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

// Канал, в который tasks-service публикует события изменений задач.
const TaskChannel = "mimi:events:tasks"

// Типы событий. Используйте константы — они лежат в общем контракте
// и читаются в notifications-service напрямую.
type TaskEventType string

const (
	TaskAssigned       TaskEventType = "task_assigned"
	TaskStatusChanged  TaskEventType = "task_status_changed"
	TaskUnassigned     TaskEventType = "task_unassigned"
)

// TaskEvent — полезная нагрузка, публикуемая при изменении задачи.
// Минимально достаточно, чтобы notifications-service сформировал читаемое
// сообщение без доп. запросов: title уже внутри.
type TaskEvent struct {
	Type       TaskEventType `json:"type"`
	TaskID     string        `json:"task_id"`
	ProjectID  string        `json:"project_id"`
	Title      string        `json:"title"`
	Status     string        `json:"status,omitempty"`
	PrevStatus string        `json:"prev_status,omitempty"`
	// AssigneeID — получатель уведомления. Если пусто, событие
	// игнорируется notifications-service'ом.
	AssigneeID string    `json:"assignee_id,omitempty"`
	ActorID    string    `json:"actor_id"`
	At         time.Time `json:"at"`
}

// Publish кодирует и шлёт событие в канал TaskChannel. Ошибки Redis'а
// логируются сервисом-источником, но не прерывают основную операцию.
func Publish(ctx context.Context, rdb *redis.Client, e TaskEvent) error {
	if e.At.IsZero() {
		e.At = time.Now().UTC()
	}
	b, err := json.Marshal(e)
	if err != nil {
		return err
	}
	return rdb.Publish(ctx, TaskChannel, b).Err()
}
