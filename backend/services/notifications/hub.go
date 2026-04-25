package notifications

import "sync"

// Hub держит активные SSE-каналы клиентов в этом инстансе сервиса.
//
// Архитектурное замечание: при горизонтальном масштабировании (несколько
// инстансов notifications-service за NGINX) клиент подключается только к
// одному из них. Чтобы доставлять туда уведомление, нужно дополнительно
// re-publish'ить в Redis-канал mimi:notifications:user:{userID} и каждый
// инстанс должен подписываться на свой набор пользователей. В MVP с одним
// инстансом достаточно in-process broadcast'а.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]map[chan Notification]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[string]map[chan Notification]struct{})}
}

// Subscribe возвращает канал для конкретного пользователя. Канал нужно
// освобождать через Unsubscribe при закрытии SSE-соединения.
//
// Размер буфера 8 — компромисс: «всплеск» уведомлений в один момент не
// блокирует publisher, а медленный клиент не отъест память.
func (h *Hub) Subscribe(userID string) chan Notification {
	ch := make(chan Notification, 8)
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[userID]; !ok {
		h.clients[userID] = make(map[chan Notification]struct{})
	}
	h.clients[userID][ch] = struct{}{}
	return ch
}

func (h *Hub) Unsubscribe(userID string, ch chan Notification) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if subs, ok := h.clients[userID]; ok {
		delete(subs, ch)
		if len(subs) == 0 {
			delete(h.clients, userID)
		}
	}
	close(ch)
}

// Broadcast non-blocking шлёт уведомление всем активным клиентам пользователя.
// Если канал клиента переполнен — пропускаем именно этот send (клиент тормозит).
func (h *Hub) Broadcast(userID string, n Notification) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients[userID] {
		select {
		case ch <- n:
		default:
			// Drop: клиент не успевает читать.
		}
	}
}

// SubscriberCount — для отладки / метрик.
func (h *Hub) SubscriberCount(userID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID])
}
