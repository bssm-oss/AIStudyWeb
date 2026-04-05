# CLI and server baseline

## Status

Snapshot

## Summary

This record captures the current RewardLab baseline for local startup and HTTP serving.

## What changed

* Added a Go CLI entrypoint at `cmd/rewardlab/main.go`
* Added `rewardlab serve` command handling in `internal/cli`
* Added configurable local server startup with `--host`, `--port`, and `--open`
* Added graceful shutdown behavior driven by context cancellation and signals
* Added `/healthz` endpoint in `internal/server`
* Added OS-specific browser opening in `internal/browser`

## Evidence

* `cmd/rewardlab/main.go`
* `internal/cli/cli.go`
* `internal/browser/browser.go`
* `internal/server/server.go`
* `internal/cli/cli_test.go`
* `internal/browser/browser_test.go`
* `internal/server/server_test.go`

## Notes

This is a local-only runtime. The current server does not expose a simulation API or persistent storage.
