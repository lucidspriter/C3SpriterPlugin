# Phase 4 — Render to the screen

## Goal
Display Spriter animations through the Construct renderer so the MVP requirement of "load and play an animation" is visibly met.

## Checklist
- [ ] Translate the legacy `Draw` routine to SDK v2, adapting renderer calls to the new APIs.
- [ ] Handle flipping, blending, texture atlas lookups, and layer ordering so each timeline element renders correctly.
- [ ] Build or update a Construct test project to confirm animations appear and respond to playback actions.

## Using this file
- Capture renderer-specific quirks (e.g., batching limits, WebGL requirements) in notes next to the relevant checklist item.
- If multiple rendering paths are needed (canvas vs. WebGL, character maps, etc.), create sub-files such as `phase-04a-webgl.md` and link them below.
- Remember to attach screenshots or GIFs to PRs demonstrating the animation once this phase is complete.
- When exploring a non-self-draw mode that spawns separate Construct objects, evaluate whether the runtime's scene graph API
  can replace manual parent/child bookkeeping. If it does, apply scaling to child objects directly rather than scaling the bone
  nodes to avoid diagonal squishing artifacts.

## Sub-phases
_None yet. Add bullet links here when you split out deeper work._
