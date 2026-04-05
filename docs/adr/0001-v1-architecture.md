# ADR 0001, RewardLab v1 architecture

## Status

Accepted

## Date

2026-04-06

## Context

RewardLab currently exists as a small local teaching application for a single lesson on epsilon-greedy multi-armed bandits. The repository needs a clear architectural baseline that explains how the current implementation is composed and what is intentionally out of scope.

The code today shows a narrow design:

* a Go CLI starts the app
* a local HTTP server serves the web lesson and `/healthz`
* static assets are embedded into the Go binary
* the simulation itself runs entirely in browser JavaScript

## Decision

Use a local-first architecture with a thin Go host and a browser-side lesson runtime.

### Chosen structure

* `cmd/rewardlab` is the executable entrypoint
* `internal/cli` owns command parsing and startup coordination
* `internal/server` owns HTTP serving, route registration, and graceful shutdown
* `internal/browser` owns OS-specific browser opening
* `web` owns embedded static assets and lesson behavior

### HTTP surface

The server exposes:

* `/` for the main lesson page
* `/assets/*` for embedded static files
* `/healthz` for basic health checking

### Simulation placement

The epsilon-greedy lesson logic lives in `web/app.js`.

This includes:

* seeded pseudo-random generation
* hidden true-mean generation per arm
* reward sampling
* epsilon-greedy action selection
* incremental estimate updates
* rendering of metrics, charts, and recent history

## Why this decision fits the current repo

This structure matches the implementation already present and keeps the code easy to understand.

* The Go side stays small and testable.
* The lesson can be served from a single binary because assets are embedded.
* Browser execution keeps the teaching logic close to the UI.
* The app works fully offline after startup.

## Consequences

### Positive

* Simple local developer workflow
* No runtime dependency on external services
* Small and direct test surface
* Easy distribution as a single compiled CLI plus embedded assets

### Trade-offs

* Simulation logic is not reusable as a Go package today
* There is no API boundary for external clients
* There is no persistence or experiment history
* Multi-user or remote-hosted use cases are not addressed

## Explicit non-goals for v1

The current architecture does not attempt to provide:

* multiple lessons
* multiple bandit strategies
* server-side simulation
* saved experiments
* authentication or accounts
* cloud deployment workflow

## Follow-up expectations

If the project later adds server-side simulation, persistent state, or more lessons, create a new ADR or superseding ADR instead of quietly stretching this one.
