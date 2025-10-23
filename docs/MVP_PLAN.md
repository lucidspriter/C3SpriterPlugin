# Spriter SDK v2 Port Roadmap

This document captures the high-level phases required to port the Spriter plugin to Construct's Addon SDK v2 and provides entry points to more detailed checklists for each phase. Use it alongside `AGENTS.md` to understand the current focus and what remains.

## How to use this roadmap

1. Review the phase list below to see the overall progression toward the MVP and beyond. Each phase links to its own checklist.
2. Open the corresponding phase file when you begin work to see detailed tasks, add notes, or record blockers.
3. Use your judgement to select a manageable slice of work at a time; if the next set of tasks looks large enough to risk context loss or tangled bugs, pause and ask your human collaborator to review progress before continuing. Avoid over-splitting trivial or tightly-coupled changes.
4. Update the checkboxes in both this overview and the phase files as tasks are completed so newcomers can instantly see progress.
5. Record any external follow-ups (e.g., SDK gaps) in `requests for ashley.txt` as described in `AGENTS.md`.

## Phase overview

- [x] [Phase 1 — Define the MVP contract](phases/phase-01-define-mvp-contract.md)
- [ ] [Phase 2 — Recreate the SDK v2 runtime skeleton](phases/phase-02-runtime-skeleton.md) — Start by reviewing the
  [Phase 01a legacy runtime survey](phases/phase-01a-legacy-runtime-survey.md) for the subsystems that need to be
  reconstructed in SDK v2.
- [ ] [Phase 3 — Implement ticking and playback control](phases/phase-03-ticking-and-playback.md)
- [ ] [Phase 4 — Render to the screen](phases/phase-04-rendering.md)
- [ ] [Phase 5 — Harden the MVP](phases/phase-05-mvp-hardening.md)
- [ ] [Phase 6 — Parity and polish](phases/phase-06-parity-and-polish.md)

Only mark a phase complete after all checkboxes in its dedicated file are checked.

## Creating additional sub-phases or documents

- When a phase becomes large, create sub-phase files under `docs/phases/` using a descriptive suffix, e.g., `phase-03a-timescale-support.md`. Link them from the parent phase file under a "Sub-phases" heading.
- Keep naming consistent and ordered lexicographically so they remain easy to scan (`phase-03a`, `phase-03b`, etc.).
- If a sub-phase emerges that multiple agents will touch, add a short summary of its scope and owner at the top of the new file.

## Keeping the roadmap healthy

- Each phase file contains guidance on when to expand with additional checklists; follow those prompts to keep work manageable.
- Consider adding dates, owners, or notes next to checkboxes if coordination across agents is needed.
- If priorities shift (e.g., we choose to skip ahead to rendering), update the order or status annotations in this file so the plan stays truthful.
