package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewRequiresOllamaModelWhenExperimentalEnabled(t *testing.T) {
	t.Parallel()

	_, err := New(Config{Host: "127.0.0.1", Port: 0, ExperimentalOllama: true})
	if err == nil {
		t.Fatal("New() error = nil, want non-nil")
	}
}

func TestNewRejectsRemoteOllamaURLWhenExperimentalEnabled(t *testing.T) {
	t.Parallel()

	_, err := New(Config{
		Host:               "127.0.0.1",
		Port:               0,
		ExperimentalOllama: true,
		OllamaModel:        "test-model",
		OllamaURL:          "https://example.com",
	})
	if err == nil {
		t.Fatal("New() error = nil, want non-nil")
	}
}

func TestValidateOllamaURLAcceptsLoopbackHosts(t *testing.T) {
	t.Parallel()

	urls := []string{
		"http://127.0.0.1:11434",
		"http://localhost:11434",
		"http://[::1]:11434",
	}

	for _, rawURL := range urls {
		if err := validateOllamaURL(rawURL); err != nil {
			t.Fatalf("validateOllamaURL(%q) error = %v", rawURL, err)
		}
	}
}

func TestOllamaGuideHandlerRejectsInvalidRequests(t *testing.T) {
	t.Parallel()

	handler := newOllamaGuideHandler(Config{ExperimentalOllama: true, OllamaModel: "test-model", OllamaURL: DefaultOllamaURL})
	req := httptest.NewRequest(http.MethodPost, "/experimental/ollama/guide", strings.NewReader(`{"step":0,"totalSteps":1,"arms":[]}`))
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("status code = %d, want %d", res.Code, http.StatusBadRequest)
	}
}

func TestOllamaGuideHandlerCallsUpstreamAndReturnsChoice(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/generate" {
			t.Fatalf("path = %q, want /api/generate", r.URL.Path)
		}

		var request ollamaGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("Decode() error = %v", err)
		}

		if request.Model != "test-model" {
			t.Fatalf("model = %q, want test-model", request.Model)
		}

		if !strings.Contains(request.Prompt, `"step": 1`) {
			t.Fatalf("prompt missing state payload: %q", request.Prompt)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"response":"{\"armIndex\":1,\"reason\":\"highest estimate so far\"}","done":true}`))
	}))
	defer upstream.Close()

	handler := newOllamaGuideHandler(Config{ExperimentalOllama: true, OllamaModel: "test-model", OllamaURL: upstream.URL})
	payload := []byte(`{"step":1,"totalSteps":10,"arms":[{"index":0,"pulls":2,"estimate":0.4,"rewardSum":0.8},{"index":1,"pulls":1,"estimate":0.9,"rewardSum":0.9}]}`)
	req := httptest.NewRequest(http.MethodPost, "/experimental/ollama/guide", bytes.NewReader(payload))
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d body=%q", res.Code, http.StatusOK, res.Body.String())
	}

	var response ollamaGuideResponse
	if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}

	if response.ArmIndex != 1 {
		t.Fatalf("arm index = %d, want 1", response.ArmIndex)
	}
}

func TestOllamaGuideHandlerReturnsBadGatewayForUpstreamErrors(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "model unavailable", http.StatusBadGateway)
	}))
	defer upstream.Close()

	handler := newOllamaGuideHandler(Config{ExperimentalOllama: true, OllamaModel: "test-model", OllamaURL: upstream.URL})
	payload := []byte(`{"step":1,"totalSteps":10,"arms":[{"index":0,"pulls":1,"estimate":0.1,"rewardSum":0.1},{"index":1,"pulls":0,"estimate":0,"rewardSum":0}]}`)
	req := httptest.NewRequest(http.MethodPost, "/experimental/ollama/guide", bytes.NewReader(payload))
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusBadGateway {
		t.Fatalf("status code = %d, want %d", res.Code, http.StatusBadGateway)
	}
}
