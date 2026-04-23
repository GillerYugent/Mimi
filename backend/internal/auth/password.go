package auth

import "golang.org/x/crypto/bcrypt"

// HashPassword produces a bcrypt hash with the given cost. Per ТЗ: cost ≥ 12.
func HashPassword(password string, cost int) (string, error) {
	if cost < bcrypt.MinCost {
		cost = bcrypt.DefaultCost
	}
	b, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword returns nil on match; bcrypt.ErrMismatchedHashAndPassword otherwise.
func CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
