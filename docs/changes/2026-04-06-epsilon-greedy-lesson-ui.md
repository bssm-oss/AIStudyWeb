# Epsilon-greedy lesson UI

## Status

Snapshot

## Summary

This record captures the current browser lesson shipped by RewardLab.

## What changed

* Added embedded static assets for the lesson UI
* Added a single lesson focused on epsilon-greedy multi-armed bandits
* Added browser-side simulation using seeded pseudo-random generation
* Added controls for arms, epsilon, steps, and seed
* Added visual summaries for reward, optimal-arm selection, exploration share, arm estimates, and recent pull history

## Evidence

* `web/assets.go`
* `web/index.html`
* `web/styles.css`
* `web/app.js`
* `test/serve_integration_test.go`
* `internal/server/server_test.go`

## Notes

The simulation currently runs entirely in `web/app.js`. The Go server only serves the page and assets.
