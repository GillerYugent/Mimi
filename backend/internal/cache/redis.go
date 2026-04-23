package cache

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// Connect parses a redis:// URL, opens a client and pings to verify.
func Connect(ctx context.Context, url string) (*redis.Client, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse REDIS_URL: %w", err)
	}
	c := redis.NewClient(opts)
	if err := c.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return c, nil
}
