# CI baseline

## Status

Snapshot

## Summary

Added the first continuous integration workflow for RewardLab and aligned repository metadata with that new automation.

## What changed

* Added `.github/workflows/ci.yml` for formatting, vet, test, build, and smoke-check validation
* Added `.gitignore` for IDE files, local smoke-test output, and built binaries
* Updated `AGENTS.md` so its current-state scope matches the presence of CI

## Evidence

* `.github/workflows/ci.yml`
* `.gitignore`
* `AGENTS.md`

## Notes

This workflow validates the current local-first application only. It does not add release, deployment, or publishing automation.
