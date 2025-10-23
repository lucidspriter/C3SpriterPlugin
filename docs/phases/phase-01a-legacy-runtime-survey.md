# Phase 01a — Legacy runtime survey

## Purpose
This note captures the minimum systems from the legacy SDK v1 runtime under
`scml/c3runtime` that are required to load and display a Spriter animation.
It should be used alongside `phase-01-define-mvp-contract.md` when deciding
what to port to SDK v2.

## Legacy subsystems needed for the MVP
- **Instance state and ticking** – `onCreate` initialises the per-instance
  caches, playback flags, and registers both tick passes so animation logic
  runs even before explicit actions are invoked.【F:scml/c3runtime/instance.js†L633-L737】【F:scml/c3runtime/instance.js†L1999-L2007】
- **Shared asset caching** – the plugin type preloads sprite sheet frames and
  tracks the parsed SCON data so that multiple Spriter instances reuse the same
  definitions.【F:scml/c3runtime/type.js†L18-L38】
- **SCON loading & hydration** – instances asynchronously request the `.scon`
  project file, then `doRequest` populates entities, triggers the
  `readyForSetup` condition, and notifies any waiting instances so they can
  share the parsed data.【F:scml/c3runtime/instance.js†L739-L755】【F:scml/c3runtime/instance.js†L3805-L3834】
- **Data model construction** – `setEntitiesToOtherEntities` and the helper
  constructors at the end of the file materialise entities, animations,
  timelines, and object metadata from the raw SCON JSON.【F:scml/c3runtime/instance.js†L331-L406】【F:scml/c3runtime/instance.js†L5371-L5556】
- **Per-frame playback** – `Tick` clears overrides each frame, while `Tick2`
  ensures data is loaded, advances animation time, pauses when outside the
  viewport buffer, and drives `ProcessNonSoundAnimation` / `animateCharacter`
  to update sprite timelines.【F:scml/c3runtime/instance.js†L1999-L2211】【F:scml/c3runtime/instance.js†L2244-L2319】
- **Rendering** – `Draw` iterates the current mainline key, resolves sprite
  frames, applies mirroring and pivot math, and submits textured quads to the
  renderer.【F:scml/c3runtime/instance.js†L79-L307】

## Minimum behaviours to port to SDK v2
- Implement `_onCreate` to capture initial properties, bootstrap ticking, and
  kick off SCON loading/caching so the instance mirrors the legacy setup
  workflow.【F:scml2/c3runtime/instance.js†L5-L33】【F:scml/c3runtime/instance.js†L633-L755】
- Implement `_tick` (and any auxiliary update helpers) to merge the legacy
  `Tick`/`Tick2` responsibilities: reset overrides, ensure data availability,
  advance animation time, and drive sprite/object updates before rendering.
  【F:scml2/c3runtime/instance.js†L35-L38】【F:scml/c3runtime/instance.js†L1999-L2211】
- Implement `_draw` to reuse the prepared timeline state and emit the correct
  textured quads so single-entity animations display in the layout, matching
  the SDK v1 behaviour.【F:scml2/c3runtime/instance.js†L30-L33】【F:scml/c3runtime/instance.js†L79-L307】
- Flesh out `_release`, `_onDestroy`, and save/load helpers to clean up shared
  caches and persist any per-instance state required for savegames, mirroring
  the structure provided by the legacy runtime stubs.【F:scml2/c3runtime/instance.js†L15-L49】【F:scml/c3runtime/instance.js†L318-L328】

## Open questions
No SDK gaps or blocking questions were identified during this survey, so no
entry is required in `requests for ashley.txt` at this time.
