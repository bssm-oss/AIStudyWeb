package browser

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func TestOSOpenerOpenUsesPlatformCommand(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		goos     string
		wantName string
		wantArgs []string
	}{
		{
			name:     "darwin",
			goos:     "darwin",
			wantName: "open",
			wantArgs: []string{"http://127.0.0.1:8090"},
		},
		{
			name:     "linux",
			goos:     "linux",
			wantName: "xdg-open",
			wantArgs: []string{"http://127.0.0.1:8090"},
		},
		{
			name:     "windows",
			goos:     "windows",
			wantName: "rundll32",
			wantArgs: []string{"url.dll,FileProtocolHandler", "http://127.0.0.1:8090"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			runner := &recordingRunner{}
			opener := OSOpener{GOOS: tt.goos, Runner: runner}

			if err := opener.Open(context.Background(), "http://127.0.0.1:8090"); err != nil {
				t.Fatalf("Open() error = %v", err)
			}

			if runner.name != tt.wantName {
				t.Fatalf("command name = %q, want %q", runner.name, tt.wantName)
			}

			if !reflect.DeepEqual(runner.args, tt.wantArgs) {
				t.Fatalf("command args = %#v, want %#v", runner.args, tt.wantArgs)
			}
		})
	}
}

func TestOSOpenerOpenReturnsRunnerError(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("boom")
	opener := OSOpener{
		GOOS:   "darwin",
		Runner: &recordingRunner{err: wantErr},
	}

	err := opener.Open(context.Background(), "http://127.0.0.1:8090")
	if err == nil {
		t.Fatal("Open() error = nil, want non-nil")
	}

	if !errors.Is(err, wantErr) {
		t.Fatalf("Open() error = %v, want wrapped %v", err, wantErr)
	}
}

type recordingRunner struct {
	name string
	args []string
	err  error
}

func (r *recordingRunner) Start(_ context.Context, name string, args ...string) error {
	r.name = name
	r.args = append([]string(nil), args...)
	return r.err
}
