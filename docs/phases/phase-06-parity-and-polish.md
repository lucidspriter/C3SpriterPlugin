# Phase 6 — Parity and polish

## Goal
Achieve feature parity with the legacy addon, optimize performance, and finalize documentation and samples.

## Checklist
- [ ] Port the remaining actions, conditions, and expressions from the README roadmap, validating against legacy behaviour. _(Sound import + sound trigger ACEs are now present in `scml2`; legacy ACE alias IDs have been started for migration compatibility, broader parity remains.)_
  - Added this pass: animation blending ACEs (`SetSecondAnim`, `SetAnimBlendRatio`, `StopSecondAnim`, `CompareSecondAnimation`, blend/second-animation expressions), object/action-point query ACEs, legacy visibility/opacity actions, misc time-scale/layer/visibility/collision toggles, and Z-elevation/bounding-box expressions.
  - Remaining high-value ACE groups: char maps (`append/remove/removeAll`), object/bone overrides + IK, URL/event/tag/variable ACEs, and `SetZElevation`.
- [ ] Optimize rendering and ticking paths (batching, caching, Construct feature compatibility).
- [ ] Refresh README/docs with SDK v2 instructions and updated example projects.

## Using this file
- Keep a running list of completed API groups or optimization wins beneath the relevant checkboxes.
- Split major efforts (e.g., documentation overhaul vs. performance tuning) into sub-phase files such as `phase-06a-performance.md` and link them below.
- Note any external dependencies or release criteria (e.g., Construct store submission requirements).

## Sub-phases
_None yet. Add bullet links here when you split out deeper work._
