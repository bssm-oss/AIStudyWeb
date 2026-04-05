# Change records

This directory stores human-readable change records for RewardLab.

## Purpose

Use these files to capture meaningful work in a way that helps future maintainers and AI agents understand how the repository evolved.

## Convention

Create one markdown file per change set.

Filename pattern:

```text
YYYY-MM-DD-short-topic.md
```

Recommended sections:

```md
# Title

## Status
Snapshot

## Summary
Short explanation of the change.

## What changed
* Item
* Item

## Evidence
* Files touched
* Commands run

## Notes
Limits, constraints, or follow-up context.
```

## Important rule

Write facts, not fiction. If a record is created after the implementation already exists, say that it captures the current repository state as a snapshot.
