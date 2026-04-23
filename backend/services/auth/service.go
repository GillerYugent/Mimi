package auth

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gilleryugent/mimi-backend/internal/auth"
	"github.com/gilleryugent/mimi-backend/internal/config"
	"github.com/redis/go-redis/v9"
)

// Service holds business-logic methods of auth-service. Handlers in handler.go
// remain thin — they deal with HTTP and delegate to this struct.
type Service struct {
	repo  *Repo
	rdb   *redis.Client
	cfg   *config.Config
}

func NewService(repo *Repo, rdb *redis.Client, cfg *config.Config) *Service {
	return &Service{repo: repo, rdb: rdb, cfg: cfg}
}

var (
	ErrValidation      = errors.New("validation")
	ErrInvalidCreds    = errors.New("invalid credentials")
	ErrInvalidToken    = errors.New("invalid refresh token")
	emailRegex         = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
)

// Register creates a user and returns a fresh token pair. Email is stored in
// lower-case form to keep logins case-insensitive.
func (s *Service) Register(ctx context.Context, req RegisterRequest) (*TokenResponse, error) {
	name := strings.TrimSpace(req.Name)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if name == "" {
		return nil, fmt.Errorf("%w: name required", ErrValidation)
	}
	if !emailRegex.MatchString(email) {
		return nil, fmt.Errorf("%w: invalid email", ErrValidation)
	}
	if len(req.Password) < 6 {
		return nil, fmt.Errorf("%w: password must be at least 6 chars", ErrValidation)
	}

	hash, err := auth.HashPassword(req.Password, s.cfg.BcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &User{
		Name:              name,
		Email:             email,
		PasswordHash:      hash,
		NotificationPrefs: DefaultPrefs(),
	}
	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, u)
}

// Login verifies credentials and returns a token pair.
func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenResponse, error) {
	u, err := s.repo.ByEmail(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	if errors.Is(err, ErrNotFound) {
		return nil, ErrInvalidCreds
	}
	if err != nil {
		return nil, err
	}
	if err := auth.CheckPassword(u.PasswordHash, req.Password); err != nil {
		return nil, ErrInvalidCreds
	}
	return s.issueTokens(ctx, u)
}

// Refresh validates a refresh token against Redis and rotates it.
func (s *Service) Refresh(ctx context.Context, refresh string) (*TokenResponse, error) {
	claims, err := auth.Parse(s.cfg.JWTSecret, refresh)
	if err != nil || claims.Type != auth.RefreshToken {
		return nil, ErrInvalidToken
	}

	// Confirm the jti is still whitelisted in Redis (not logged out / rotated).
	key := refreshKey(claims.UserID, claims.JTI)
	if n, err := s.rdb.Exists(ctx, key).Result(); err != nil || n == 0 {
		return nil, ErrInvalidToken
	}

	// Rotate: delete old, issue new pair.
	if err := s.rdb.Del(ctx, key).Err(); err != nil {
		return nil, err
	}
	u, err := s.repo.ByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, u)
}

// Logout removes a refresh token from the whitelist so it can no longer
// be exchanged. Access tokens remain valid until their short TTL expires.
func (s *Service) Logout(ctx context.Context, refresh string) error {
	claims, err := auth.Parse(s.cfg.JWTSecret, refresh)
	if err != nil {
		return nil // treat as idempotent no-op
	}
	_ = s.rdb.Del(ctx, refreshKey(claims.UserID, claims.JTI)).Err()
	return nil
}

func (s *Service) Me(ctx context.Context, userID string) (*User, error) {
	return s.repo.ByID(ctx, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (*User, error) {
	if req.Email != nil {
		e := strings.ToLower(strings.TrimSpace(*req.Email))
		if !emailRegex.MatchString(e) {
			return nil, fmt.Errorf("%w: invalid email", ErrValidation)
		}
		req.Email = &e
	}
	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if n == "" {
			return nil, fmt.Errorf("%w: name cannot be empty", ErrValidation)
		}
		req.Name = &n
	}
	return s.repo.UpdateProfile(ctx, userID, req)
}

func (s *Service) ChangePassword(ctx context.Context, userID string, req ChangePasswordRequest) error {
	if len(req.Next) < 6 {
		return fmt.Errorf("%w: new password too short", ErrValidation)
	}
	u, err := s.repo.ByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := auth.CheckPassword(u.PasswordHash, req.Current); err != nil {
		return ErrInvalidCreds
	}
	hash, err := auth.HashPassword(req.Next, s.cfg.BcryptCost)
	if err != nil {
		return err
	}
	return s.repo.UpdatePasswordHash(ctx, userID, hash)
}

func (s *Service) UpdateNotificationPrefs(ctx context.Context, userID string, p NotificationPrefs) error {
	return s.repo.UpdateNotificationPrefs(ctx, userID, p)
}

// issueTokens produces and records a fresh access+refresh pair.
func (s *Service) issueTokens(ctx context.Context, u *User) (*TokenResponse, error) {
	access, _, err := auth.Issue(s.cfg.JWTSecret, u.ID, auth.AccessToken, s.cfg.AccessTTL)
	if err != nil {
		return nil, err
	}
	refresh, jti, err := auth.Issue(s.cfg.JWTSecret, u.ID, auth.RefreshToken, s.cfg.RefreshTTL)
	if err != nil {
		return nil, err
	}
	// Whitelist the refresh token jti in Redis with the matching TTL.
	if err := s.rdb.Set(ctx, refreshKey(u.ID, jti), "1", s.cfg.RefreshTTL).Err(); err != nil {
		return nil, err
	}
	return &TokenResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(s.cfg.AccessTTL / time.Second),
		User:         u,
	}, nil
}

func refreshKey(userID, jti string) string {
	return fmt.Sprintf("auth:refresh:%s:%s", userID, jti)
}
