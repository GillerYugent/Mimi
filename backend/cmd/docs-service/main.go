package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gilleryugent/mimi-backend/internal/cache"
	"github.com/gilleryugent/mimi-backend/internal/config"
	"github.com/gilleryugent/mimi-backend/internal/db"
	"github.com/gilleryugent/mimi-backend/internal/httpx"
	"github.com/gilleryugent/mimi-backend/internal/log"
	"github.com/gilleryugent/mimi-backend/services/docs"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	cfg, err := config.Load("docs-service")
	if err != nil {
		panic(err)
	}
	logger := log.Init(cfg.ServiceName, cfg.LogLevel)

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("connect db", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, "/migrations/docs"); err != nil {
		logger.Error("migrate", "err", err)
		os.Exit(1)
	}

	rdb, err := cache.Connect(ctx, cfg.RedisURL)
	if err != nil {
		logger.Error("connect redis", "err", err)
		os.Exit(1)
	}
	defer rdb.Close()

	repo := docs.NewRepo(pool)
	svc := docs.NewService(repo)
	handler := docs.NewHandler(svc, cfg.JWTSecret)

	r := mux.NewRouter()
	r.Use(httpx.Recover)
	r.Use(httpx.AccessLog)

	r.HandleFunc("/healthz", httpx.Health(nil, nil, false))
	r.HandleFunc("/readyz", httpx.Health(pool, rdb, true))

	handler.Register(r)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           cors.AllowAll().Handler(r),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("docs-service listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
