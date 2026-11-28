package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestLoopbackAddressPolicy(t *testing.T) {
	for _, addr := range []string{"127.0.0.1:8083", "localhost:8083", "[::1]:8083"} {
		if !isLoopbackAddress(addr) { t.Errorf("expected loopback address: %s",addr) }
	}
	for _, addr := range []string{"0.0.0.0:8083", ":8083", "192.0.2.10:8083"} {
		if isLoopbackAddress(addr) { t.Errorf("expected non-loopback address: %s",addr) }
	}
}

func TestCORSRequiresExplicitAllowedOrigin(t *testing.T) {
	old := os.Getenv("JX1_ALLOWED_ORIGINS")
	defer os.Setenv("JX1_ALLOWED_ORIGINS",old)
	if err := os.Setenv("JX1_ALLOWED_ORIGINS","https://game.example.test"); err != nil { t.Fatal(err) }
	next := http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) { w.WriteHeader(http.StatusOK) })
	handler := secureHTTPHandler(next)

	allowed := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet,"/health",nil)
	request.Header.Set("Origin","https://game.example.test")
	handler.ServeHTTP(allowed,request)
	if allowed.Header().Get("Access-Control-Allow-Origin") != "https://game.example.test" {
		t.Fatal("expected explicitly allowed origin")
	}

	denied := httptest.NewRecorder()
	preflight := httptest.NewRequest(http.MethodOptions,"/api/world/move",nil)
	preflight.Header.Set("Origin","https://untrusted.example.test")
	handler.ServeHTTP(denied,preflight)
	if denied.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden preflight, got %d",denied.Code)
	}
}
