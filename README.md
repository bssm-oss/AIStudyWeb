# RewardLab

RewardLab is the current product identity for the Go module `github.com/bssm-oss/AIStudyWeb`.

Today this repository ships one local learning experience: a single lesson on epsilon-greedy multi-armed bandits. The app runs as a Go CLI that starts a local HTTP server and serves embedded web assets. The lesson itself runs in the browser with plain JavaScript. There is no database, no remote API, and no server-side simulation endpoint in the current implementation.

## What exists today

* One CLI entrypoint: `rewardlab serve`
* One local web server with a health endpoint at `/healthz`
* One embedded lesson UI at `/`
* One simulation model, epsilon-greedy bandits, computed entirely in the browser
* Go unit and integration tests for the CLI, browser opener, server, and served UI

## Current scope

RewardLab is intentionally narrow right now.

* Product scope: local-first teaching app
* Lesson scope: lesson 01 only
* Algorithm scope: epsilon-greedy only
* Delivery scope: embedded static web assets served by Go
* Persistence scope: none
* Network scope: local server only

If a planned change is not visible in the current codebase, it should be treated as future work, not current behavior.

## Requirements

The module currently declares:

```text
module github.com/bssm-oss/AIStudyWeb
go 1.26.1
```

Use a Go toolchain compatible with `go.mod`.

## Install and run

Run the app directly from source:

```bash
go run ./cmd/rewardlab serve
```

Useful flags:

* `--host`, default `127.0.0.1`
* `--port`, default `8080`
* `--open`, default `true`

Examples:

```bash
go run ./cmd/rewardlab serve --open=false
go run ./cmd/rewardlab serve --host=127.0.0.1 --port=9090 --open=false
```

Build the CLI:

```bash
go build ./cmd/rewardlab
```

When started successfully, the CLI prints a line like:

```text
RewardLab listening on http://127.0.0.1:8080
```

## Test commands

Run the full test suite:

```bash
go test ./...
```

This repository currently has tests in:

* `internal/browser`
* `internal/cli`
* `internal/server`
* `test`

## How the app works

The runtime flow is simple.

1. `cmd/rewardlab/main.go` creates a signal-aware context.
2. `internal/cli` parses the `serve` command and flags.
3. `internal/server` starts an HTTP server and exposes `/healthz` plus the web UI routes.
4. `web/assets.go` serves embedded `index.html`, `styles.css`, and `app.js`.
5. `web/app.js` runs the epsilon-greedy simulation in the browser and renders the lesson.

The browser experience is seeded and deterministic for the same control values because the lesson uses a seeded pseudo-random generator in `web/app.js`.

## Architecture at a glance

### CLI layer

`internal/cli` owns command parsing and startup orchestration. It depends on abstractions for browser opening and server creation so tests can stub those pieces.

### Browser opener

`internal/browser` maps the current operating system to the expected open command.

* macOS: `open`
* Linux: `xdg-open`
* Windows: `rundll32 url.dll,FileProtocolHandler`

### HTTP server

`internal/server` owns server construction, startup, shutdown, health checking, and route registration. The server returns a normalized local URL, even when listening on port `0` or wildcard hosts.

### Web assets

The `web` package embeds and serves three files.

* `index.html` defines the lesson layout
* `styles.css` provides the visual system
* `app.js` handles controls, simulation, summaries, charts, and recent pull history

### Simulation model

The current lesson simulates a k-armed bandit in JavaScript.

* Each arm gets a hidden true mean from a normal distribution
* Rewards are sampled as true mean plus normal noise
* The policy explores with probability `epsilon`
* Otherwise it exploits the arm with the highest estimated value
* Estimates are updated with an incremental sample mean

The UI shows summary metrics, arm-by-arm true versus estimated values, interpretation cards, and the latest ten pulls.

## Repository layout

```text
cmd/rewardlab/         CLI entrypoint
internal/browser/      OS-specific browser opening
internal/cli/          command parsing and app startup
internal/server/       HTTP server and routing
test/                  black-box integration tests
web/                   embedded static lesson assets
docs/adr/              architecture decisions
docs/changes/          change records
AGENTS.md              repo rules for AI contributors
```

## Constraints

The current codebase has a few important boundaries.

* The app is local-first. It does not talk to external services.
* The lesson runs in browser JavaScript, not on the Go server.
* The server serves content and health only. It does not expose a simulation API.
* There is one lesson and one strategy today.
* Documentation should describe current behavior, not planned features.

## Workflow expectations

For future work, keep the repository disciplined.

* Match the existing module path and product name: `github.com/bssm-oss/AIStudyWeb` and RewardLab
* Keep docs aligned with real code after every meaningful change
* Record notable changes as new markdown files in `docs/changes/`
* Update the ADR set when architecture decisions change
* Do not invent undocumented features in README or agent guidance

See `AGENTS.md` for the repository rules intended for future AI and automation.

## License

RewardLab is available under the MIT License. See `LICENSE`.
