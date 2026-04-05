package server

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewHandlerServesRootAssetsAndHealthz(t *testing.T) {
	t.Parallel()

	handler := NewHandler()

	requests := []struct {
		name        string
		path        string
		wantCode    int
		wantContain string
	}{
		{name: "root", path: "/", wantCode: http.StatusOK, wantContain: "RewardLab"},
		{name: "healthz", path: "/healthz", wantCode: http.StatusOK, wantContain: "ok"},
		{name: "app js", path: "/assets/app.js", wantCode: http.StatusOK, wantContain: "runSimulation"},
		{name: "favicon", path: "/favicon.ico", wantCode: http.StatusNoContent, wantContain: ""},
	}

	for _, tt := range requests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)

			if res.Code != tt.wantCode {
				t.Fatalf("status code = %d, want %d", res.Code, tt.wantCode)
			}

			if tt.wantContain != "" && !strings.Contains(res.Body.String(), tt.wantContain) {
				t.Fatalf("body = %q, want substring %q", res.Body.String(), tt.wantContain)
			}
		})
	}
}

func TestAppStartServesHTTPUntilContextCancel(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app, err := New(Config{Host: "127.0.0.1", Port: 0})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	url, err := app.Start(ctx)
	if err != nil {
		t.Fatalf("Start() error = %v", err)
	}

	client := &http.Client{Timeout: time.Second}
	resp, err := client.Get(url + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz error = %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status code = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	if strings.TrimSpace(string(body)) != "ok" {
		t.Fatalf("body = %q, want ok", string(body))
	}

	cancel()

	if err := app.Wait(); err != nil {
		t.Fatalf("Wait() error = %v", err)
	}
}
