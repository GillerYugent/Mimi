package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TokenType identifies whether a JWT is for API access or for refresh flow.
type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

// Claims is the custom JWT payload shared by every service.
type Claims struct {
	UserID string    `json:"sub"`
	Type   TokenType `json:"type"`
	JTI    string    `json:"jti"`
	jwt.RegisteredClaims
}

// Issue creates a signed JWT of the given type. jti (JWT ID) is unique per token,
// which lets us store / revoke refresh tokens in Redis by userID + jti.
func Issue(secret []byte, userID string, t TokenType, ttl time.Duration) (string, string, error) {
	jti := uuid.NewString()
	now := time.Now().UTC()
	claims := Claims{
		UserID: userID,
		Type:   t,
		JTI:    jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			Subject:   userID,
			Issuer:    "mimi",
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(secret)
	if err != nil {
		return "", "", err
	}
	return signed, jti, nil
}

// Parse verifies the signature and expiration and returns the claims.
func Parse(secret []byte, token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(tok *jwt.Token) (interface{}, error) {
		if _, ok := tok.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
