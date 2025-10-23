# Phase 5 — Harden the MVP

## Goal
Stabilize the MVP by supporting persistence, debugging, and essential scripting hooks so teams can rely on the addon in real projects.

## Checklist
- [ ] Implement `_saveToJson` and `_loadFromJson` for critical runtime state (current entity, animation, playback time, etc.).
- [ ] Populate `_getDebuggerProperties` with useful inspection data (e.g., selected animation, paused/playing state).
- [ ] Port high-value conditions and expressions such as "Current animation" and playback time queries.

## Using this file
- When adding serialization or debugger fields, document any SDK constraints or design decisions inline.
- If the scope branches significantly (e.g., saving/loading vs. debugger), create sub-phase files like `phase-05a-serialization.md` and link them below.
- Capture regression tests or Construct project links that validate the hardening work.

## Sub-phases
_None yet. Add bullet links here when you split out deeper work._
