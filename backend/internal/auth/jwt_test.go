package auth

import (
	"testing"
	"time"
)

func TestIssueAndParse_RoundTrip(t *testing.T) {
	secret := []byte("test-secret-32-bytes-please-rotate")
	tok, jti, err := Issue(secret, "user-1", AccessToken, 15*time.Minute)
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if tok == "" || jti == "" {
		t.Fatalf("expected non-empty token and jti, got tok=%q jti=%q", tok, jti)
	}

	claims, err := Parse(secret, tok)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Fatalf("UserID: want user-1, got %s", claims.UserID)
	}
	if claims.Type != AccessToken {
		t.Fatalf("Type: want access, got %s", claims.Type)
	}
	if claims.JTI != jti {
		t.Fatalf("JTI mismatch: want %s, got %s", jti, claims.JTI)
	}
}

func TestParse_RejectsExpired(t *testing.T) {
	secret := []byte("test-secret-32-bytes-please-rotate")
	tok, _, err := Issue(secret, "user-1", AccessToken, -1*time.Second)
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if _, err := Parse(secret, tok); err == nil {
		t.Fatalf("expected expired token to be rejected")
	}
}

func TestParse_RejectsWrongSecret(t *testing.T) {
	tok, _, err := Issue([]byte("alpha-32-bytes-........................"), "u", AccessToken, time.Minute)
	if err != nil {
		t.Fatalf("Issue() error: %v", err)
	}
	if _, err := Parse([]byte("beta-32-bytes-........................."), tok); err == nil {
		t.Fatalf("expected wrong-secret token to be rejected")
	}
}

func TestIssue_GeneratesUniqueJTI(t *testing.T) {
	secret := []byte("test-secret-32-bytes-please-rotate")
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		_, jti, err := Issue(secret, "u", AccessToken, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		if seen[jti] {
			t.Fatalf("duplicate jti at i=%d", i)
		}
		seen[jti] = true
	}
}

func TestRefreshToken_TypeIsPropagated(t *testing.T) {
	secret := []byte("test-secret-32-bytes-please-rotate")
	tok, _, err := Issue(secret, "u", RefreshToken, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := Parse(secret, tok)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Type != RefreshToken {
		t.Fatalf("Type: want refresh, got %s", claims.Type)
	}
}
