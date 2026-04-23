package httpx

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Health returns a handler that checks DB + Redis connectivity. Used for both
// /healthz (liveness) and /readyz (readiness) — the distinction is that we
// pass `required=true` for /readyz and skip checks for /healthz.
func Health(pool *pgxpool.Pool, rdb *redis.Client, required bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !required {
			JSON(w, http.StatusOK, map[string]string{"status": "ok"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if pool != nil {
			if err := pool.Ping(ctx); err != nil {
				Err(w, http.StatusServiceUnavailable, "db_unavailable", err.Error())
				return
			}
		}
		if rdb != nil {
			if err := rdb.Ping(ctx).Err(); err != nil {
				Err(w, http.StatusServiceUnavailable, "redis_unavailable", err.Error())
				return
			}
		}
		JSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}
}
