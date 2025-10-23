# Phase 2 — Recreate the SDK v2 runtime skeleton

## Goal
Port the foundational runtime structure to SDK v2 so Spriter instances can be created, hold state, and clean up correctly.

## Checklist
- [x] Port initialization/storage fields from the legacy instance into the SDK v2 constructor and `_onCreate` implementation.
- [ ] Implement asset loading and parsing helpers to ensure Spriter data is available during `_onCreate`.
- [ ] Add `_onDestroy` and `_release` cleanup logic for textures, timelines, and event listeners created during initialization.

## Using this file
- Mark checkboxes once code lands in `scml2/` with tests or validation notes.
- Capture dependencies (e.g., required Construct runtime APIs) in line-comments or in `requests for ashley.txt`.
- If this phase becomes unwieldy, spin off sub-phases like `phase-02a-asset-loading.md` and link them below.

## Sub-phases
_None yet. Add bullet links here when you split out deeper work._
