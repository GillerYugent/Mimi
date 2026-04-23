package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/gilleryugent/mimi-backend/internal/httpx"
)

type ctxKey int

const (
	userIDKey ctxKey = iota
	claimsKey
)

// Middleware verifies the Authorization: Bearer <access> header and injects
// user id + claims into the request context. Requests without a valid access
// token are rejected with 401.
//
// NGINX gateway ALSO validates tokens before proxying; this middleware is the
// second line of defence and the canonical source of `userID` inside handlers.
func Middleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authz := r.Header.Get("Authorization")
			if !strings.HasPrefix(authz, "Bearer ") {
				httpx.Err(w, http.StatusUnauthorized, "missing_token", "Authorization header required")
				return
			}
			token := strings.TrimPrefix(authz, "Bearer ")
			claims, err := Parse(secret, token)
			if err != nil {
				httpx.Err(w, http.StatusUnauthorized, "invalid_token", err.Error())
				return
			}
			if claims.Type != AccessToken {
				httpx.Err(w, http.StatusUnauthorized, "wrong_token_type", "access token required")
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
			ctx = context.WithValue(ctx, claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserID extracts the authenticated user id from the context set by Middleware.
// Returns empty string when the request is unauthenticated.
func UserID(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}

// FromContext returns the full claims set for fine-grained inspection.
func FromContext(ctx context.Context) *Claims {
	v, _ := ctx.Value(claimsKey).(*Claims)
	return v
}
