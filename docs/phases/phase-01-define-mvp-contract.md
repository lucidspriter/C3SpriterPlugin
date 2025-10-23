# Phase 1 — Define the MVP contract

## Goal
Clarify the minimum behaviour required to "load and display a Spriter animation" using SDK v2, establishing the reference scope for the MVP.

## Checklist
- [x] Review the legacy runtime under `scml/c3runtime` to list the subsystems needed for loading, ticking, and drawing a single animation. See the findings captured in [`phase-01a-legacy-runtime-survey.md`](phase-01a-legacy-runtime-survey.md).
- [x] Document the agreed-upon MVP behaviours and required SDK v2 lifecycle hooks in a shared design note (e.g., markdown in `docs/`). The same survey file lists the minimum behaviours to port first.
- [x] Record open questions or missing SDK features in `requests for ashley.txt` with references. None were identified during this pass, so no entry was required.

## Using this file
- Update the checklist as you confirm each item. Add short notes or links next to checkboxes if helpful for later phases.
- If the investigation grows, create sub-phase files under `docs/phases/` with a `phase-01x-*.md` naming pattern and link them below.

## Sub-phases
- [Phase 01a — Legacy runtime survey](phase-01a-legacy-runtime-survey.md)
