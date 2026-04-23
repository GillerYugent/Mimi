package log

import (
	"log/slog"
	"os"
	"strings"
)

// Init returns a structured JSON logger bound to the given service name.
// Level is one of: debug, info, warn, error.
func Init(service, level string) *slog.Logger {
	var lv slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lv = slog.LevelDebug
	case "warn":
		lv = slog.LevelWarn
	case "error":
		lv = slog.LevelError
	default:
		lv = slog.LevelInfo
	}
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lv})
	l := slog.New(h).With("service", service)
	slog.SetDefault(l)
	return l
}
