package browser

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
)

type Opener interface {
	Open(ctx context.Context, url string) error
}

type Runner interface {
	Start(ctx context.Context, name string, args ...string) error
}

type OSOpener struct {
	GOOS   string
	Runner Runner
}

func NewDefault() OSOpener {
	return OSOpener{
		GOOS:   runtime.GOOS,
		Runner: execRunner{},
	}
}

func (o OSOpener) Open(ctx context.Context, url string) error {
	name, args, err := commandFor(o.GOOS, url)
	if err != nil {
		return err
	}

	if err := o.Runner.Start(ctx, name, args...); err != nil {
		return fmt.Errorf("start browser command: %w", err)
	}

	return nil
}

func commandFor(goos, url string) (string, []string, error) {
	switch goos {
	case "darwin":
		return "open", []string{url}, nil
	case "linux":
		return "xdg-open", []string{url}, nil
	case "windows":
		return "rundll32", []string{"url.dll,FileProtocolHandler", url}, nil
	default:
		return "", nil, fmt.Errorf("browser opening is unsupported on %q", goos)
	}
}

type execRunner struct{}

func (execRunner) Start(ctx context.Context, name string, args ...string) error {
	return exec.CommandContext(ctx, name, args...).Start()
}
