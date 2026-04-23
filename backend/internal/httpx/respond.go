package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error is the canonical JSON body returned to clients on any failure.
type Error struct {
	Code    string `json:"code"`
	Message string `json:"error"`
}

// JSON writes a JSON-encoded body with the given status code.
func JSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("json encode failed", "err", err)
	}
}

// Err writes a JSON error with a stable code and human message.
func Err(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, Error{Code: code, Message: message})
}

// Decode parses the JSON request body into dst. On failure writes a 400.
func Decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		Err(w, http.StatusBadRequest, "invalid_body", err.Error())
		return false
	}
	return true
}
