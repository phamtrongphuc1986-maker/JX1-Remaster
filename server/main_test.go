package main

import (
    "bytes"
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)

func TestRandomTokenFormatAndUniqueness(t *testing.T) {
    first, err := randomToken()
    if err != nil { t.Fatalf("randomToken() error = %v", err) }
    second, err := randomToken()
    if err != nil { t.Fatalf("randomToken() second call error = %v", err) }
    if len(first) != 64 { t.Fatalf("token length = %d, want 64 hex characters", len(first)) }
    if first == second { t.Fatal("randomToken() returned the same token twice") }
}

func TestDecodeAcceptsSingleJSONObject(t *testing.T) {
    req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"test"}`))
    rec := httptest.NewRecorder()
    var got struct { Name string `json:"name"` }
    if !decode(rec, req, &got) { t.Fatalf("decode() rejected valid JSON: %s", rec.Body.String()) }
    if got.Name != "test" { t.Fatalf("decoded name = %q, want test", got.Name) }
}

func TestDecodeRejectsTrailingJSON(t *testing.T) {
    req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"one"} {"name":"two"}`))
    rec := httptest.NewRecorder()
    var got map[string]string
    if decode(rec, req, &got) { t.Fatal("decode() accepted multiple JSON values") }
    if rec.Code != http.StatusBadRequest { t.Fatalf("status = %d, want 400", rec.Code) }
}

func TestDecodeRejectsOversizedBody(t *testing.T) {
    body := bytes.NewBufferString(`{"value":"` + strings.Repeat("x", 5000) + `"}`)
    req := httptest.NewRequest(http.MethodPost, "/", body)
    rec := httptest.NewRecorder()
    var got map[string]string
    if decode(rec, req, &got) { t.Fatal("decode() accepted body larger than 4096 bytes") }
    if rec.Code != http.StatusBadRequest { t.Fatalf("status = %d, want 400", rec.Code) }
}

func TestClassListRequiresGET(t *testing.T) {
    req := httptest.NewRequest(http.MethodPost, "/api/classes", nil)
    rec := httptest.NewRecorder()
    classList(rec, req)
    if rec.Code != http.StatusMethodNotAllowed { t.Fatalf("status = %d, want 405", rec.Code) }
}

func TestClassListReturnsTenClasses(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/classes", nil)
	rec := httptest.NewRecorder()
	classList(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"count":10`) {
		t.Fatalf("response does not report 10 classes: %s", rec.Body.String())
	}
}

func TestListCharactersRejectsNonGETBeforeAuthentication(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/characters", nil)
	rec := httptest.NewRecorder()
	listCharacters(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}
