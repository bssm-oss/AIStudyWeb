package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	webui "github.com/bssm-oss/AIStudyWeb/web"
)

const shutdownTimeout = 5 * time.Second

// Config defines how the local RewardLab HTTP server binds on startup.
type Config struct {
	Host               string
	Port               int
	ExperimentalOllama bool
	OllamaModel        string
	OllamaURL          string
}

// App manages the lifecycle of the local RewardLab HTTP server.
type App struct {
	config   Config
	http     *http.Server
	listener net.Listener
	errCh    chan error
}

// New validates the server configuration and constructs a new local app instance.
func New(cfg Config) (*App, error) {
	if cfg.Host == "" {
		cfg.Host = "127.0.0.1"
	}

	if cfg.Port < 0 || cfg.Port > 65535 {
		return nil, fmt.Errorf("port must be between 0 and 65535: %d", cfg.Port)
	}

	if cfg.ExperimentalOllama {
		if cfg.OllamaModel == "" {
			return nil, errors.New("ollama model is required when experimental ollama mode is enabled")
		}

		if cfg.OllamaURL == "" {
			cfg.OllamaURL = DefaultOllamaURL
		}

		if err := validateOllamaURL(cfg.OllamaURL); err != nil {
			return nil, err
		}
	}

	return &App{
		config: cfg,
		http: &http.Server{
			Addr:              net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
			Handler:           NewHandler(cfg),
			ReadHeaderTimeout: shutdownTimeout,
		},
	}, nil
}

// NewHandler returns the root HTTP handler for the current RewardLab routes.
func NewHandler(cfg Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	if cfg.ExperimentalOllama {
		mux.Handle("/experimental/ollama/guide", newOllamaGuideHandler(cfg))
	}
	webui.RegisterRoutes(mux, webui.RuntimeConfig{
		ExperimentalOllamaEnabled: cfg.ExperimentalOllama,
		OllamaModel:               cfg.OllamaModel,
	})
	return mux
}

// Start begins serving HTTP and returns the reachable local URL for the running app.
func (a *App) Start(ctx context.Context) (string, error) {
	if a.listener != nil {
		return "", errors.New("server already started")
	}

	ln, err := net.Listen("tcp", a.http.Addr)
	if err != nil {
		return "", fmt.Errorf("listen: %w", err)
	}

	a.listener = ln
	a.errCh = make(chan error, 1)

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = a.Shutdown(shutdownCtx)
	}()

	go func() {
		defer close(a.errCh)
		if err := a.http.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			a.errCh <- err
		}
	}()

	return a.URL(), nil
}

// Wait blocks until the server exits or returns a serving error.
func (a *App) Wait() error {
	if a.errCh == nil {
		return errors.New("server not started")
	}

	err, ok := <-a.errCh
	if !ok {
		return nil
	}

	return err
}

// Shutdown gracefully stops the HTTP server if it has been started.
func (a *App) Shutdown(ctx context.Context) error {
	if a.listener == nil {
		return nil
	}

	return a.http.Shutdown(ctx)
}

// URL returns the normalized local browser URL for the running app.
func (a *App) URL() string {
	if a.listener == nil {
		return ""
	}

	_, port, err := net.SplitHostPort(a.listener.Addr().String())
	if err != nil {
		return ""
	}

	host := a.config.Host
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}

	return fmt.Sprintf("http://%s", net.JoinHostPort(host, port))
}

func healthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}
