package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/bssm-oss/AIStudyWeb/internal/browser"
	"github.com/bssm-oss/AIStudyWeb/internal/server"
)

// Server describes the runtime behavior needed by the CLI to start, observe, and stop the local app.
type Server interface {
	Start(ctx context.Context) (string, error)
	Wait() error
	Shutdown(ctx context.Context) error
}

// Dependencies holds the concrete integrations the CLI uses for output, browser startup, and server creation.
type Dependencies struct {
	Stdout    io.Writer
	Stderr    io.Writer
	Opener    browser.Opener
	NewServer func(cfg server.Config) (Server, error)
}

// DefaultDependencies returns the production dependency set used by the RewardLab CLI.
func DefaultDependencies() Dependencies {
	return Dependencies{
		Stdout: os.Stdout,
		Stderr: os.Stderr,
		Opener: browser.NewDefault(),
		NewServer: func(cfg server.Config) (Server, error) {
			return server.New(cfg)
		},
	}
}

// Run executes the RewardLab CLI with the provided arguments and integrations.
func Run(ctx context.Context, args []string, deps Dependencies) error {
	deps = withDefaults(deps)

	if len(args) == 0 {
		writeUsage(deps.Stderr)
		return errors.New("missing command: expected 'serve'")
	}

	switch args[0] {
	case "serve":
		return runServe(ctx, args[1:], deps)
	default:
		writeUsage(deps.Stderr)
		return fmt.Errorf("unknown command %q", args[0])
	}
}

type serveOptions struct {
	Host               string
	Port               int
	Open               bool
	ExperimentalOllama bool
	OllamaModel        string
	OllamaURL          string
}

func runServe(ctx context.Context, args []string, deps Dependencies) error {
	options, err := parseServeOptions(args, deps.Stderr)
	if err != nil {
		return err
	}

	srv, err := deps.NewServer(server.Config{
		Host:               options.Host,
		Port:               options.Port,
		ExperimentalOllama: options.ExperimentalOllama,
		OllamaModel:        options.OllamaModel,
		OllamaURL:          options.OllamaURL,
	})
	if err != nil {
		return err
	}

	url, err := srv.Start(ctx)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(deps.Stdout, "RewardLab listening on %s\n", url); err != nil {
		_ = srv.Shutdown(context.Background())
		return fmt.Errorf("write startup message: %w", err)
	}

	if options.Open {
		if err := deps.Opener.Open(ctx, url); err != nil {
			_ = srv.Shutdown(context.Background())
			return fmt.Errorf("open browser: %w", err)
		}
	}

	return srv.Wait()
}

func parseServeOptions(args []string, stderr io.Writer) (serveOptions, error) {
	options := serveOptions{}
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.StringVar(&options.Host, "host", "127.0.0.1", "Host interface for the local web server")
	fs.IntVar(&options.Port, "port", 8080, "Port for the local web server")
	fs.BoolVar(&options.Open, "open", true, "Open the default browser after startup")
	fs.BoolVar(&options.ExperimentalOllama, "experimental-ollama", false, "Enable the experimental local Ollama-guided bandit mode")
	fs.StringVar(&options.OllamaModel, "ollama-model", "", "Local Ollama model name for experimental guided mode")
	fs.StringVar(&options.OllamaURL, "ollama-url", server.DefaultOllamaURL, "Base URL for the local Ollama server")

	if err := fs.Parse(args); err != nil {
		return serveOptions{}, err
	}

	if fs.NArg() != 0 {
		return serveOptions{}, fmt.Errorf("unexpected arguments: %v", fs.Args())
	}

	return options, nil
}

func withDefaults(deps Dependencies) Dependencies {
	defaults := DefaultDependencies()

	if deps.Stdout == nil {
		deps.Stdout = defaults.Stdout
	}

	if deps.Stderr == nil {
		deps.Stderr = defaults.Stderr
	}

	if deps.Opener == nil {
		deps.Opener = defaults.Opener
	}

	if deps.NewServer == nil {
		deps.NewServer = defaults.NewServer
	}

	return deps
}

func writeUsage(w io.Writer) {
	_, _ = io.WriteString(w, "Usage: rewardlab serve [--host=127.0.0.1] [--port=8080] [--open=true|false] [--experimental-ollama] [--ollama-model=name] [--ollama-url=http://127.0.0.1:11434]\n")
}
