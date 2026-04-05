package test

import (
	"context"
	"io"
	"net/http"
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
