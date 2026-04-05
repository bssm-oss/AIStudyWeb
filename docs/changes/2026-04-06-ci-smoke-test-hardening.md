# CI smoke test hardening

## Status

Snapshot

## Summary

Replaced the brittle shell polling in the CI smoke test with a more reliable Python-based HTTP readiness check.

## What changed

* Kept the binary build and startup flow the same
* Replaced curl-and-grep loop logic with Python polling using standard-library HTTP requests
* Preserved the same assertions for `/healthz` and the lesson title at `/`

## Evidence

* `.github/workflows/ci.yml`
* local built-binary smoke test output

## Notes

This change improves CI reliability only. It does not change RewardLab application behavior.
