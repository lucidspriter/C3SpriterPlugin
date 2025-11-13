# Phase 3 — Implement ticking and playback control

## Goal
Ensure the SDK v2 runtime can advance Spriter animations each tick and expose minimal controls to choose entities and animations.

## Checklist
- [x] Port timekeeping helpers (e.g., `getNowTime`) and ensure they respect Construct's timescale options when advancing animations.
- [x] Implement entity/animation selection logic and keyframe interpolation so playback state updates every `_tick`.
- [x] Expose at least one action (e.g., `Set Animation`) through `C3.Plugins.Spriter.Acts` to drive playback from Construct events.

## Using this file
- Record timing edge cases or Construct integration notes inline so later contributors understand constraints.
- Break out complex subsystems—such as blending or event firing—into `phase-03x-*.md` sub-phases when needed and link them below.

## Sub-phases
_None yet. Add bullet links here when you split out deeper work._
