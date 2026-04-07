package test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bssm-oss/AIStudyWeb/internal/server"
)

func TestRewardLabServerServesUIAndHealthz(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app, err := server.New(server.Config{Host: "127.0.0.1", Port: 0})
	if err != nil {
		t.Fatalf("server.New() error = %v", err)
	}

	baseURL, err := app.Start(ctx)
	if err != nil {
		t.Fatalf("app.Start() error = %v", err)
	}

	client := &http.Client{Timeout: 2 * time.Second}

	uiResp, err := client.Get(baseURL + "/")
	if err != nil {
		t.Fatalf("GET / error = %v", err)
	}
	defer uiResp.Body.Close()

	uiBody, err := io.ReadAll(uiResp.Body)
	if err != nil {
		t.Fatalf("ReadAll(ui) error = %v", err)
	}

	if uiResp.StatusCode != http.StatusOK {
		t.Fatalf("GET / status = %d, want %d", uiResp.StatusCode, http.StatusOK)
	}

	if !strings.Contains(string(uiBody), "Epsilon-greedy multi-armed bandits") {
		t.Fatalf("GET / body missing lesson title: %q", string(uiBody))
	}

	healthResp, err := client.Get(baseURL + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz error = %v", err)
	}
	defer healthResp.Body.Close()

	healthBody, err := io.ReadAll(healthResp.Body)
	if err != nil {
		t.Fatalf("ReadAll(healthz) error = %v", err)
	}

	if healthResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /healthz status = %d, want %d", healthResp.StatusCode, http.StatusOK)
	}

	if strings.TrimSpace(string(healthBody)) != "ok" {
		t.Fatalf("GET /healthz body = %q, want ok", string(healthBody))
	}

	cancel()

	if err := app.Wait(); err != nil {
		t.Fatalf("app.Wait() error = %v", err)
	}
}

func TestRewardLabExperimentalOllamaGuideRoute(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"response":"{\"armIndex\":0,\"reason\":\"sample the first arm\"}","done":true}`))
	}))
	defer upstream.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app, err := server.New(server.Config{
		Host:               "127.0.0.1",
		Port:               0,
		ExperimentalOllama: true,
		OllamaModel:        "test-model",
		OllamaURL:          upstream.URL,
	})
	if err != nil {
		t.Fatalf("server.New() error = %v", err)
	}

	baseURL, err := app.Start(ctx)
	if err != nil {
		t.Fatalf("app.Start() error = %v", err)
	}

	client := &http.Client{Timeout: 2 * time.Second}
	guideReq, err := http.NewRequest(http.MethodPost, baseURL+"/experimental/ollama/guide", strings.NewReader(`{"step":1,"totalSteps":8,"arms":[{"index":0,"pulls":1,"estimate":0.2,"rewardSum":0.2},{"index":1,"pulls":1,"estimate":0.1,"rewardSum":0.1}]}`))
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	guideReq.Header.Set("Content-Type", "application/json")

	guideResp, err := client.Do(guideReq)
	if err != nil {
		t.Fatalf("POST /experimental/ollama/guide error = %v", err)
	}
	defer guideResp.Body.Close()

	guideBody, err := io.ReadAll(guideResp.Body)
	if err != nil {
		t.Fatalf("ReadAll(guide) error = %v", err)
	}

	if guideResp.StatusCode != http.StatusOK {
		t.Fatalf("POST /experimental/ollama/guide status = %d, want %d body=%q", guideResp.StatusCode, http.StatusOK, string(guideBody))
	}

	if !strings.Contains(string(guideBody), `"armIndex":0`) {
		t.Fatalf("POST /experimental/ollama/guide body = %q, want armIndex 0", string(guideBody))
	}

	cancel()

	if err := app.Wait(); err != nil {
		t.Fatalf("app.Wait() error = %v", err)
	}
}
