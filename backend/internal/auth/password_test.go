package auth

import (
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestHashPassword_VerifiesItsOwnHash(t *testing.T) {
	const password = "secret123!@#"
	hash, err := HashPassword(password, 10) // в тестах cost=10 для скорости
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(hash, "$2") {
		t.Fatalf("ожидался bcrypt-хэш, получено: %s", hash)
	}
	if err := CheckPassword(hash, password); err != nil {
		t.Fatalf("CheckPassword: должен совпасть, получено: %v", err)
	}
}

func TestCheckPassword_RejectsWrongPassword(t *testing.T) {
	hash, _ := HashPassword("a", 10)
	if err := CheckPassword(hash, "b"); err == nil {
		t.Fatalf("ожидался mismatch")
	}
}

func TestHashPassword_RespectsMinCost(t *testing.T) {
	// Если передать cost ниже bcrypt.MinCost, наша обёртка должна
	// подставить DefaultCost — иначе библиотека упадёт.
	hash, err := HashPassword("x", 0)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	cost, err := bcrypt.Cost([]byte(hash))
	if err != nil {
		t.Fatal(err)
	}
	if cost < bcrypt.MinCost {
		t.Fatalf("ожидали cost >= %d, получили %d", bcrypt.MinCost, cost)
	}
}

// Соответствует требованию ТЗ из практики 4: bcrypt cost factor ≥ 12 в проде.
// Тест документирует константу: пользователи Service'а получают именно cost из
// конфига (BCRYPT_COST=12 в .env.example).
func TestHashPassword_AcceptsCost12(t *testing.T) {
	hash, err := HashPassword("x", 12)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	cost, _ := bcrypt.Cost([]byte(hash))
	if cost != 12 {
		t.Fatalf("ожидали cost=12, получили %d", cost)
	}
}
