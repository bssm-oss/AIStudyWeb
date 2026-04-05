# RewardLab agent guide

This repository uses the product identity RewardLab. The Go module path is `github.com/bssm-oss/AIStudyWeb`.

This file tells future AI agents how to work in this repo without drifting away from the current implementation.

## Source of truth

Document and change only what exists in code.

* Do not invent APIs, lessons, strategies, storage layers, or deployment stories.
* Do not describe planned features as if they already ship.
* If code and docs disagree, update docs to match code unless the task explicitly asks for implementation work too.

## Current product scope

RewardLab currently contains:

* one Go CLI command, `rewardlab serve`
* one local HTTP server
* one embedded web UI
* one lesson, epsilon-greedy multi-armed bandits

It does not currently contain:

* a JSON API
* persisted state
* user accounts
* multiple lessons
* multiple bandit strategies
* release automation

## Architecture summary

* `cmd/rewardlab/main.go` starts the CLI with signal-aware shutdown.
* `internal/cli` parses command flags and coordinates startup.
* `internal/server` serves `/`, `/assets/*`, and `/healthz`.
* `internal/browser` opens the local URL in the default browser.
* `web/` contains the embedded UI and browser-side simulation logic.

The simulation happens in `web/app.js`. The Go server does not compute bandit results.

## Repository rules

When working here, follow these rules.

* Keep the current product name, RewardLab, in user-facing docs unless a task explicitly renames it.
* Preserve the module path `github.com/bssm-oss/AIStudyWeb` unless the code itself is being migrated.
* Treat the current single-lesson epsilon-greedy scope as the active boundary.
* Prefer small, explicit changes over broad speculative refactors.
* Do not add CI files, release automation, or deployment docs unless asked.
* Do not commit or push unless the user explicitly asks.
* Do not change behavior just to make docs easier. If a tiny code comment helps accuracy, keep it minimal.

## Documentation expectations

Every meaningful change should keep these files accurate.

* `README.md` for human onboarding
* `AGENTS.md` for future AI contributors
* `docs/adr/` for architectural choices
* `docs/changes/` for change records

## Change record convention

Add a new markdown file in `docs/changes/` for each meaningful change set.

Suggested filename pattern:

```text
YYYY-MM-DD-short-topic.md
```

Suggested structure:

```md
# Title

## Status
Snapshot

## Summary
Short human-readable description.

## What changed
* Item
* Item

## Evidence
* File paths
* Commands run

## Notes
Any limits, follow-ups, or scope boundaries.
```

Use plain factual language. If a record is written after the fact, say that it captures the current state as a snapshot.

## Verification expectations

Before finishing a task that edits code or docs:

* run relevant tests
* run a build when the project can be built
* confirm docs match real commands, routes, and filenames

For this repository today, the baseline checks are:

```bash
go test ./...
go build ./cmd/rewardlab
node --test web/app.test.js
```

## Writing style

Prefer clear, product-grade prose.

* Write for humans first
* Keep statements concrete and verifiable
* Use current-state wording such as “currently” or “today” when scope is narrow
* Avoid filler and speculation
