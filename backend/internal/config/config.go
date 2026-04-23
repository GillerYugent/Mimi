package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds the envelope of environment-driven configuration shared
// across every microservice. Per-service extras sit in their own structs.
type Config struct {
	ServiceName string
	Port        string

	DatabaseURL string
	RedisURL    string

	JWTSecret  []byte
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	BcryptCost int

	LogLevel string
}

func Load(service string) (*Config, error) {
	// .env is optional — missing is fine in production containers.
	_ = godotenv.Load()

	jwt := env("JWT_SECRET", "")
	if len(jwt) < 16 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 16 bytes")
	}

	accessTTL, err := time.ParseDuration(env("ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid ACCESS_TTL: %w", err)
	}
	refreshTTL, err := time.ParseDuration(env("REFRESH_TTL", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid REFRESH_TTL: %w", err)
	}
	cost, err := strconv.Atoi(env("BCRYPT_COST", "12"))
	if err != nil {
		return nil, fmt.Errorf("invalid BCRYPT_COST: %w", err)
	}

	return &Config{
		ServiceName: service,
		Port:        env("PORT", "8080"),
		DatabaseURL: env("DATABASE_URL", ""),
		RedisURL:    env("REDIS_URL", ""),
		JWTSecret:   []byte(jwt),
		AccessTTL:   accessTTL,
		RefreshTTL:  refreshTTL,
		BcryptCost:  cost,
		LogLevel:    env("LOG_LEVEL", "info"),
	}, nil
}

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
