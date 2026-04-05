package cli

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/bssm-oss/AIStudyWeb/internal/server"
)

func TestRunServeSkipsBrowserWhenOpenFalse(t *testing.T) {
	t.Parallel()

	stdout := &bytes.Buffer{}
	opener := &recordingOpener{}
	srv := &stubServer{url: "http://127.0.0.1:8090"}
	var gotConfig server.Config

	err := Run(context.Background(), []string{"serve", "--open=false", "--port=8090"}, Dependencies{
		Stdout: stdout,
		Stderr: &bytes.Buffer{},
		Opener: opener,
		NewServer: func(cfg server.Config) (Server, error) {
			gotConfig = cfg
			return srv, nil
		},
	})

	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	if !srv.startCalled {
		t.Fatal("server Start() was not called")
	}

	if opener.url != "" {
		t.Fatalf("browser url = %q, want empty", opener.url)
	}

	if gotConfig.Host != "127.0.0.1" || gotConfig.Port != 8090 {
		t.Fatalf("server config = %+v, want host 127.0.0.1 and port 8090", gotConfig)
	}

	if !strings.Contains(stdout.String(), "RewardLab listening on http://127.0.0.1:8090") {
		t.Fatalf("stdout = %q, want startup message", stdout.String())
	}
}

func TestRunServeOpensBrowserWhenEnabled(t *testing.T) {
	t.Parallel()

	stdout := &bytes.Buffer{}
	opener := &recordingOpener{}
	srv := &stubServer{url: "http://127.0.0.1:8123"}

	err := Run(context.Background(), []string{"serve", "--port=8123"}, Dependencies{
		Stdout: stdout,
		Stderr: &bytes.Buffer{},
		Opener: opener,
		NewServer: func(_ server.Config) (Server, error) {
			return srv, nil
		},
	})

	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	if opener.url != srv.url {
		t.Fatalf("browser url = %q, want %q", opener.url, srv.url)
	}

	if !strings.Contains(stdout.String(), srv.url) {
		t.Fatalf("stdout = %q, want startup url", stdout.String())
	}
}

func TestRunServeReturnsBrowserOpenError(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("cannot open")
	srv := &stubServer{url: "http://127.0.0.1:8123"}
	err := Run(context.Background(), []string{"serve"}, Dependencies{
		Stdout: &bytes.Buffer{},
		Stderr: &bytes.Buffer{},
		Opener: &recordingOpener{err: wantErr},
		NewServer: func(_ server.Config) (Server, error) {
			return srv, nil
		},
	})

	if err == nil {
		t.Fatal("Run() error = nil, want non-nil")
	}

	if !errors.Is(err, wantErr) {
		t.Fatalf("Run() error = %v, want wrapped %v", err, wantErr)
	}

	if !srv.shutdownCalled {
		t.Fatal("server Shutdown() was not called after browser open failure")
	}
}

func TestRunMissingCommandWritesUsage(t *testing.T) {
	t.Parallel()

	stderr := &bytes.Buffer{}
	err := Run(context.Background(), nil, Dependencies{Stderr: stderr})
	if err == nil {
		t.Fatal("Run() error = nil, want non-nil")
	}

	if !strings.Contains(stderr.String(), "Usage: rewardlab serve") {
		t.Fatalf("usage output = %q, want serve usage", stderr.String())
	}
}

type recordingOpener struct {
	url string
	err error
}

func (o *recordingOpener) Open(_ context.Context, url string) error {
	o.url = url
	return o.err
}

type stubServer struct {
	url            string
	startErr       error
	waitErr        error
	shutdownErr    error
	startCalled    bool
	shutdownCalled bool
}

func (s *stubServer) Start(_ context.Context) (string, error) {
	s.startCalled = true
	return s.url, s.startErr
}

func (s *stubServer) Wait() error {
	return s.waitErr
}

func (s *stubServer) Shutdown(_ context.Context) error {
	s.shutdownCalled = true
	return s.shutdownErr
}
