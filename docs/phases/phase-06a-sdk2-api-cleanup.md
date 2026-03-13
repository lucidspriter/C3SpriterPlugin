# Phase 6a — SDK2 API cleanup

## Goal
Replace ad-hoc defensive API probing in `scml2/` with documented Construct Addon SDK v2 calls, without regressing the behaviour that is now working.

## Why this phase exists
- The restart in `scml2/` solved the hard runtime/parity problems first.
- That left a large amount of temporary defensive code (`callFirstMethod`, `typeof ... === "function"`, mixed casing probes, synthetic wrappers, etc.).
- The next risk is not missing features; it is silent drift away from the documented SDK surface and making future regressions harder to diagnose.

## Ground rules
- Base each replacement on the official docs first, not on guesswork.
- For runtime code in `scml2/c3runtime/`, follow the Addon SDK runtime API reference first. It explicitly states that runtime APIs are the same as Construct's scripting APIs.
- Use the Addon SDK editor/reference pages as the primary source only for editor-side code, not for runtime-side method names.
- Clean one subsystem at a time so regressions are easy to localize.
- Prefer direct SDK v2 calls when the docs are clear.
- Keep fallbacks only when the docs do not expose what the plugin needs.
- When a required capability is still not exposed cleanly, record it in `requests for ashley.txt`.
- Do not mix cleanup across unrelated subsystems in the same pass.

## Required workflow for every pass
Before editing code for a pass:
1. Re-open the relevant official SDK v2 docs for that subsystem.
2. Write out the exact translation map for the calls being replaced.
3. Include enough context that the translation is unambiguous:
   - object/context (`this`, `worldInfo`, `renderer`, `runtime`, child instance, object type, etc.)
   - current pattern in the codebase
   - documented SDK v2 replacement
   - doc/source reference used to justify it
4. Only then perform the code changes for that pass.
5. Before removing old code paths, define the manual "break detectors" for that pass: the concrete actions, conditions, expressions, and gameplay scenarios that would fail immediately if the translation is wrong.
6. If the pass is high-risk, add a temporary parity probe that logs old-path vs. new-path values for one controlled instance or event, then remove that probe once the pass is verified.

Use this format when documenting a pass:
- Context:
- Current pattern:
- Documented SDK2 call:
- Notes:
- Source:

If a pass needs many translations, add them under a short "API translation map" heading in this file or in a linked sub-note before changing code.

## Temporary parity probes
- Use probes only as short-lived verification tools during an active pass.
- Scope them narrowly:
  - one object type
  - one animation or event
  - one expression/action/condition path
- Prefer logging both values in one line, for example:
  - prior path result
  - new documented path result
  - whether they match
- Remove the probe as soon as the pass is validated.
- Do not leave probe logging in release code unless it is a real warning/error.

## Manual break-detector checklist template
For each pass, write the specific things that should break if the translation is wrong. Use this format:
- Action to try:
- Condition/expression to check:
- Expected result:
- Failure symptom if translation is wrong:
- Test layout/project note:

The goal is to make every pass testable by direct C3 interaction, not just by code inspection.

## Primary references
- Porting guide: <https://www.construct.net/en/make-games/manuals/addon-sdk/guide/porting-addon-sdk-v2>
- Addon SDK manual root: <https://www.construct.net/en/make-games/manuals/addon-sdk>
- Runtime API reference: <https://www.construct.net/en/make-games/manuals/addon-sdk/runtime-reference>
- For runtime code, the Addon SDK runtime reference and the linked scripting-reference pages take priority.
- For editor code, the Addon SDK editor/reference pages take priority.

## Ordered cleanup passes

### Pass 1 — Runtime clock + tick lifecycle
- [ ] Write the runtime/tick API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for runtime/tick timing before editing code.
- [ ] Verify the documented SDK v2 calls used for runtime time access, ticking registration, and trigger timing.
- [ ] Replace defensive runtime/tick helpers with direct documented calls where available.
- [ ] Keep the current legacy-parity behaviour of doing playback/event work from `_tick2()`.
- [ ] If needed, add a temporary parity probe for runtime time/tick values on one controlled instance, then remove it after validation.
- [ ] Re-test: animation finished triggers, event line triggers, pre-ready animation requests, and global/per-instance time scale interactions.
  - Break detectors:
    - `Set animation` -> `On animation finished` -> `Set animation` chain.
    - First-frame event trigger firing immediately after animation change/resume.
    - Global time scale `0` with per-object override restoring playback.

#### Pass 1 API translation map
- Context: Spriter runtime instance tick registration.
  - Current pattern: enable `_tick()` / `_tick2()` from wrapper helpers and older defensive checks.
  - Documented SDK2 call: `this._setTicking(true)` and `this._setTicking2(true)`.
  - Notes: `_tick()` runs before events and `_tick2()` runs after events.
  - Source: `ISDKInstanceBase` docs in the Addon SDK manual.
- Context: requesting a redraw for self-draw animation updates.
  - Current pattern: probe `runtime.sdk.updateRender` and then fall back to `runtime.UpdateRender()`/`runtime.updateRender()`.
  - Documented SDK2 call: `this.runtime.sdk.updateRender()`.
  - Notes: this should be the direct SDK2 redraw path; mixed-case runtime probing is legacy cleanup debt.
  - Source: `ISDKUtils.updateRender()` docs in the Addon SDK manual.
- Context: per-frame raw delta time unaffected by time scaling.
  - Current pattern: derive it from `GetWallTime/getWallTime`, `performance.now()`, or `Date.now()`.
  - Documented SDK2 call: `this.runtime.dtRaw`.
  - Notes: use this for ignore-global-time-scale paths and for object-specific time-scale override math.
  - Source: `IRuntime` scripting reference (`dtRaw`).
- Context: regular delta time for this instance.
  - Current pattern: manually combine wall-time deltas, runtime dt, runtime time scale, and object time scale.
  - Documented SDK2 call: `this.dt`.
  - Notes: this is the documented per-instance delta time and should remain the default path when global time scale is respected.
  - Source: `IInstance` scripting reference (`dt`).
- Context: runtime/global time scale.
  - Current pattern: read `runtime.timeScale` or probe `GetTimeScale/getTimeScale`.
  - Documented SDK2 call: `this.runtime.timeScale`.
  - Notes: use as the direct runtime time-scale source when needed.
  - Source: `IRuntime` scripting reference (`timeScale`).
- Context: instance-specific time scale override.
  - Current pattern: probe multiple targets for `timeScale` and `GetTimeScale/getTimeScale`.
  - Documented SDK2 call: `this.timeScale`, with `restoreTimeScale()` restoring follow-runtime behaviour.
  - Notes: cleanup must preserve the existing gameplay behaviour where an instance can keep animating when global time scale is `0`.
  - Source: `IInstance` scripting reference (`timeScale`, `restoreTimeScale()`).

### Pass 2 — World transform reads
- [ ] Write the world-transform-read API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for transform reads before editing code.
- [ ] Verify the documented way to read `x`, `y`, `angle`, `width`, `height`, opacity, blend mode, layer, and bounding boxes from SDK v2 world instances.
- [ ] Replace read-side helper probing with direct calls/property access backed by docs.
- [ ] If needed, add a temporary parity probe comparing old read path vs. documented read path for one instance, then remove it after validation.
- [ ] Re-test: `ObjectX/ObjectY`, point/object angle expressions, bounding-box expressions, and spawn-at-point workflows.
  - Break detectors:
    - Spawn a Sprite at `Spriter.ObjectX("point_000"), Spriter.ObjectY("point_000")`.
    - Compare `pointX/pointY`, `objectX/objectY`, and angle expressions against visible helper placement.
    - Check bbox expressions while moving/scaling the Spriter object.

#### Pass 2 API translation map
- Context: reading the Spriter instance position, angle, and size.
  - Current pattern: read `this.x`/`this.y`/`this.angle`/`this.width`/`this.height` first, then fall back to world-info getter probing.
  - Documented SDK2 call: `this.x`, `this.y`, `this.angle`, `this.width`, `this.height`.
  - Notes: this is correct for runtime code because the Addon SDK runtime reference says runtime APIs are the same as Construct's scripting APIs.
  - Source: Addon SDK runtime API reference + `IWorldInstance` scripting reference.
- Context: reading the current layer and viewport.
  - Current pattern: probe `GetLayer/getLayer` from world info and `GetViewport/getViewport` from layer, then probe left/right/top/bottom from the viewport object.
  - Documented SDK2 call: `this.layer` and `this.layer.getViewport()`.
  - Notes: `getViewport()` returns a `DOMRect`, so read `left`, `right`, `top`, and `bottom` directly from the returned rectangle. This is correct for runtime code per the Addon SDK runtime reference.
  - Source: Addon SDK runtime API reference + `IWorldInstance` scripting reference (`layer`) and `ILayer` scripting reference (`getViewport()`).
- Context: reading bounding-box values for expressions and viewport culling.
  - Current pattern: probe `GetBoundingBox/getBoundingBox` and then probe edge getters from the returned box.
  - Documented SDK2 call: `this.getBoundingBox()`.
  - Notes: this returns a `DOMRect`, so read `left`, `right`, `top`, and `bottom` directly. This is correct for runtime code per the Addon SDK runtime reference.
  - Source: Addon SDK runtime API reference + `IWorldInstance` scripting reference (`getBoundingBox()`).
- Context: reading visibility and opacity.
  - Current pattern: probe world-info getters like `GetOpacity/getOpacity` and `IsVisible`.
  - Documented SDK2 call: `this.opacity` and `this.isVisible`.
  - Notes: opacity is in the range `[0, 1]`.
  - Source: `IWorldInstance` scripting reference (`opacity`, `isVisible`).
- Context: reading blend mode.
  - Current pattern: mixed direct-property and world-info access.
  - Documented SDK2 call: `this.blendMode`.
  - Notes: `blendMode` is a string in the scripting API; where renderer calls need a different format, keep that conversion local and explicit.
  - Source: `IWorldInstance` scripting reference (`blendMode`).
- Context: reading Z elevation.
  - Current pattern: probe `GetZElevation/getZElevation` and `GetTotalZElevation/getTotalZElevation`.
  - Documented SDK2 call: `this.zElevation` and `this.totalZElevation`.
  - Notes: use the direct property that matches the expression being evaluated.
  - Source: `IWorldInstance` scripting reference (`zElevation`, `totalZElevation`).

### Pass 3 — World transform writes
- [ ] Write the world-transform-write API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for transform writes before editing code.
- [ ] Verify the documented way to set position, size, angle, origin, visibility, collision state, and bbox invalidation.
- [ ] Replace write-side probing with direct documented calls.
- [ ] Preserve the `l/t/r/b` animation-bounds behaviour and the SDK2 fallback-origin fix that was added for self-draw bounds parity.
- [ ] If needed, add a temporary parity probe for one write path (e.g. position/origin/collision toggle), then remove it after validation.
- [ ] Re-test: associated sprites/boxes/points, collision boxes, pin/set-to actions, and animation-bound shader/effect clipping.
  - Break detectors:
    - `Set position to object`, `Pin to object`, and `Set angle to object angle`.
    - Visibility/collision toggles on associated boxes during attack animations.
    - Self-draw shader/effect cutoff after animation changes.

#### Pass 3 API translation map
- Context: writing the Spriter instance size for animation bounds.
  - Current pattern: route width/height writes through world-info style setters.
  - Documented SDK2 call: assign `this.width = ...` and `this.height = ...`.
  - Notes: this is correct for runtime code because the Addon SDK runtime reference says runtime APIs are the same as Construct's scripting APIs.
  - Source: Addon SDK runtime API reference + `IWorldInstance` scripting reference.
- Context: writing self visibility, opacity, and Z elevation.
  - Current pattern: route writes through the resolved world-info/self-instance compatibility path (`SetVisible`, `SetOpacity`, `SetZElevation`).
  - Documented SDK2 call: the scripting docs indicate direct `IWorldInstance` properties (`this.isVisible`, `this.opacity`, `this.zElevation`), but direct writes to those members regressed runtime behaviour during validation of this pass.
  - Notes: keep the resolved world-info path for now until the addon-runtime setter behaviour is pinned down more confidently.
  - Source: `IWorldInstance` scripting reference plus runtime validation during this cleanup pass.
- Context: bbox invalidation after documented world-instance writes.
  - Current pattern: call `SetBboxChanged/setBboxChanged` after nearly every transform write.
  - Documented SDK2 call: no explicit documented bbox-invalidating call identified for the self instance write path.
  - Notes: for documented direct property writes, treat bounds updates as automatic unless a documented SDK2 invalidation API is found later.
  - Source: Addon SDK v2 scripting/manual surface reviewed for this pass; no documented self-instance bbox invalidation call identified.
- Context: origin/hotspot writes used by animation bounds and per-part pivot math.
  - Current pattern: probe `SetOriginX/SetOriginY` and several origin-like properties (`originX`, `hotspotX`, `pivotX`, etc.).
  - Documented SDK2 call: not yet pinned down from the official docs.
  - Notes: keep the existing compatibility path in place for now instead of guessing.
  - Source: official docs review for this pass did not yet surface a documented SDK2 origin-write API for world instances.
- Context: collision enable/disable writes on associated helper objects.
  - Current pattern: probe `SetCollisionEnabled/setCollisionEnabled` and several collision-related properties.
  - Documented SDK2 call: not yet pinned down from the official docs.
  - Notes: keep the current compatibility path in place for now instead of guessing.
  - Source: official docs review for this pass did not yet surface a documented SDK2 collision-enable API for world instances.

### Pass 4 — Renderer API surface
- [ ] Write the renderer API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for renderer calls before editing code.
- [ ] Verify the documented renderer calls for texture binding, blend mode, fill mode, opacity, color, and quad drawing.
- [ ] Replace mixed-case renderer probing with the documented SDK v2 calls.
- [ ] Keep legacy-compatible rendering behaviour intact for self-draw and atlas rendering.
- [ ] If needed, add a temporary parity probe for one renderer path (texture bind or quad draw), then remove it after validation.
- [ ] Re-test: self-draw playback, project sampling, integer scaling interaction, and effect/shader clipping.
  - Break detectors:
    - Self-draw character visibly animates with actual atlas art, not gray fallback quads.
    - Sampling/project setting changes affect output as expected.
    - Effects/shaders do not clip unexpectedly at object bounds.

#### Pass 4 API translation map
- Context: `_draw(renderer)` in `scml2/c3runtime/instance.js`.
  - Current pattern: mix runtime `IRenderer` calls with older addon/editor-style renderer probing (`SetBlendMode`, `SetTexture`, `Quad3`, etc.).
  - Documented SDK2 call: treat `renderer` as the runtime `IRenderer` surface used by `ISDKWorldInstanceBase._draw(renderer)`.
  - Notes: for runtime code, use the runtime `IRenderer` methods directly, not the editor/reference `IWebGLRenderer` surface.
  - Source: Addon SDK runtime reference + `ISDKWorldInstanceBase` runtime docs + `IRenderer` scripting reference.
- Context: renderer blend state during self-draw.
  - Current pattern: probe `SetBlendMode`, `setBlendMode`, `SetAlphaBlend`, `setAlphaBlendMode`, and an undocumented no-premultiply call.
  - Documented SDK2 call: `renderer.setBlendMode(this.blendMode)` or `renderer.setAlphaBlendMode()`.
  - Notes: keep the undocumented no-premultiply call isolated only as a compatibility fallback until the runtime docs expose an official equivalent.
  - Source: `IRenderer` scripting reference (`setBlendMode()`, `setAlphaBlendMode()`).
- Context: fill mode and texture binding.
  - Current pattern: probe `SetColorFillMode`/`setColorFillMode`, `SetTextureFillMode`/`setTextureFillMode`, and `SetTexture`/`setTexture`.
  - Documented SDK2 call: `renderer.setColorFillMode()`, `renderer.setTextureFillMode()`, `renderer.setTexture(texture)`.
  - Notes: these should be called directly in runtime draw code.
  - Source: `IRenderer` scripting reference.
- Context: renderer color/alpha state.
  - Current pattern: probe `SetColorRgba`/`setColorRgba` and `SetOpacity`/`setOpacity`.
  - Documented SDK2 call: `renderer.setColorRgba(r, g, b, a)`.
  - Notes: use direct RGBA color state for both textured and debug rendering; do not rely on legacy uppercase opacity helpers in runtime draw code.
  - Source: `IRenderer` scripting reference (`setColorRgba()`).
- Context: drawing quads in runtime self-draw.
  - Current pattern: probe `renderer.quad`, `renderer.Quad`, `renderer.quad3`, `renderer.Quad3`, then fall back to `C3.Quad`/`C3.Rect`.
  - Documented SDK2 call: `renderer.quad(domQuad)` and `renderer.quad3(domQuad, texRect)`.
  - Notes: runtime `IRenderer` expects DOMQuad-like geometry objects here; remove uppercase/editor-style fallbacks from the runtime draw path.
  - Source: `IRenderer` scripting reference (`quad()`, `quad3()`).

### Pass 5 — Asset + texture loading
- [ ] Write the asset/texture API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for asset/texture loading before editing code.
- [ ] Verify the documented SDK v2 path for image info, asset loading, and runtime texture creation.
- [ ] Replace temporary probes where the docs provide a stable surface.
- [ ] Keep unsupported legacy-frame access isolated as a compatibility fallback only where still required.
- [ ] If needed, add a temporary parity probe for one asset/texture load path, then remove it after validation.
- [ ] Re-test: drag-drop import, atlased imports, packed addon import, and legacy-project repair/reimport flow.
  - Break detectors:
    - Import a new atlased `.zip` into an empty project and verify immediate animation.
    - Load a packed `.c3addon` build and verify the same import path works.
    - Repair/reimport a legacy project and verify red-box fallback does not appear.

#### Pass 5 API translation map
- Context: runtime asset manager access from `scml2/c3runtime/type.js`.
  - Current pattern: probe `runtime.GetAssetManager()` first and then fall back to `runtime.assets`.
  - Documented SDK2 call: `runtime.assets`.
  - Notes: runtime code should use the runtime asset-manager surface directly.
  - Source: Addon SDK runtime reference + `IRuntime` scripting reference.
- Context: resolving project-file URLs.
  - Current pattern: probe `GetProjectFileUrl/getProjectFileUrl`.
  - Documented SDK2 call: `runtime.assets.getProjectFileUrl(projectFileName)`.
  - Notes: this is the official runtime asset-manager path for project files.
  - Source: runtime asset-manager scripting reference.
- Context: fetching project JSON and blobs.
  - Current pattern: probe `FetchJson/fetchJson` and `FetchBlob/fetchBlob`, then fall back to raw `fetch()`.
  - Documented SDK2 call: `runtime.assets.fetchJson(url)` and `runtime.assets.fetchBlob(url)`.
  - Notes: raw `fetch()` fallback is not part of the documented asset-manager flow and should be removed where the SDK path is clear.
  - Source: runtime asset-manager scripting reference.
- Context: runtime texture creation from decoded image data.
  - Current pattern: probe `renderer.createStaticTexture` and `renderer.CreateStaticTexture`.
  - Documented SDK2 call: `renderer.createStaticTexture(imageBitmap, options)`.
  - Notes: this is the documented runtime renderer path for addon-created textures.
  - Source: runtime `IRenderer` scripting reference.
- Context: runtime sampling mode used for static texture creation.
  - Current pattern: probe `runtime.GetSampling/getSampling` and `runtime.sampling`.
  - Documented SDK2 call: `runtime.sampling`.
  - Notes: pass the runtime sampling string through to texture creation where needed.
  - Source: `IRuntime` scripting reference.
- Context: compatibility atlas-image upload when an `IImageInfo` already exists.
  - Current pattern: probe `GetImageInfo/getImageInfo`, `GetTexture/getTexture`, `LoadStaticTexture/loadStaticTexture`, `GetTexRect/getTexRect`, `GetWidth/getWidth`, and `GetHeight/getHeight`.
  - Documented SDK2 call: use the lowercase runtime `IImageInfo` methods (`getImageInfo()`, `getTexture()`, `loadStaticTexture()`, `getTexRect()`, `getWidth()`, `getHeight()`).
  - Notes: the underlying custom-plugin animation-frame access remains an unsupported legacy compatibility path; only the `IImageInfo` method names themselves are being normalized here.
  - Source: runtime image-info scripting reference plus the existing open question about runtime access to custom plugin animation frames.

### Pass 6 — Animation state + playback core
- [ ] Write the animation/playback API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for animation/playback before editing code.
- [ ] Verify the documented instance/type APIs used by playback state, animation switching, blending, and readiness.
- [ ] Replace defensive calls that are only there to guess method casing.
- [ ] Keep working behaviour for queued pre-ready animation changes, loop overrides, blend timing, and trigger-at-start handling.
- [ ] If needed, add a temporary parity probe for one animation-state transition, then remove it after validation.
- [ ] Re-test: set animation, blend duration, second animation, forced non-looping on looping animations, and immediate `AnimationName` reads after creation.
  - Break detectors:
    - Create instance -> immediately `Set animation` -> immediately read `AnimationName`.
    - Force a looping animation to play once and confirm `On animation finished` fires.
    - Test second animation + blend ratio + blend duration transition.

### Pass 7 — Trigger + condition dispatch
- [ ] Write the trigger/condition API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for trigger/condition dispatch before editing code.
- [ ] Verify the documented trigger path for SDK v2 conditions.
- [ ] Replace defensive trigger dispatch only where the docs provide an explicit path.
- [ ] Preserve current tick/tick2 ordering that now matches legacy behaviour more closely.
- [ ] If needed, add a temporary parity probe for one trigger path, then remove it after validation.
- [ ] Re-test: `OnReady`, `On animation finished`, event triggers, sound triggers, and first-frame trigger behaviour.
  - Break detectors:
    - `OnReady` association setup for non-self-draw and collision boxes.
    - Trigger at time `0` or immediately after resume/change.
    - Event line spawning from a point during a fast animation transition.

### Pass 8 — SOL / picking / instance resolution
- [ ] Write the SOL/picking API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for SOL/picking before editing code.
- [ ] Verify the documented SDK v2 APIs for enumerating instances, picked instances, paired instances, and object-type lookup.
- [ ] Replace broad probing with direct documented calls where possible.
- [ ] Keep any undocumented but still-required compatibility fallback isolated to one helper.
- [ ] If needed, add a temporary parity probe for one instance-resolution path, then remove it after validation.
- [ ] Re-test: multiple instances of the same Spriter type, container/paired-instance scenarios, and legacy association flows.
  - Break detectors:
    - Multiple enemies of the same Spriter type with independent hitboxes.
    - Container/paired-instance behaviour using helper sprites or linked objects.
    - `Find Spriter object` and object-name lookup workflows.

### Pass 9 — Associated object application
- [ ] Write the associated-object API translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for associated-object application before editing code.
- [ ] Verify the documented way child sprite/box/helper instances should be updated each tick.
- [ ] Simplify world-info lookup, association bookkeeping, and collision/visibility syncing where docs now cover the access path.
- [ ] Preserve the fixes for helper disable-on-clear and destroy-time cleanup.
- [ ] If needed, add a temporary parity probe for one associated-object update path, then remove it after validation.
- [ ] Re-test: collision boxes, helper points, image swaps in non-self-draw mode, and per-instance association correctness under heavy combat scenes.
  - Break detectors:
    - Attack box turns on/off at the correct frames and does not linger after animation swap or destroy.
    - Non-self-draw image swaps follow frame changes.
    - Points/helpers track the correct instance under multiple simultaneous actors.

### Pass 10 — ACE surface cleanup
- [ ] Write the ACE-to-runtime helper translation map from the official SDK v2 docs before editing code.
- [ ] Write the manual break-detector checklist for the ACE group being cleaned before editing code.
- [ ] Ensure actions, conditions, and expressions call stable runtime helpers only, not ad-hoc API probes.
- [ ] Remove duplicated logic between runtime helpers and ACE files.
- [ ] If needed, add a temporary parity probe for one high-risk ACE path, then remove it after validation.
- [ ] Re-test high-risk ACE groups first: animation control, object/point expressions, blend controls, and association actions.
  - Break detectors:
    - For each ACE group touched, make one event sheet that reads the expression immediately after the paired action.
    - Verify legacy ACE aliases still produce the same gameplay result as the non-legacy version.

### Pass 11 — Fallback isolation
- [ ] Write the fallback inventory/justification list before moving or deleting compatibility code.
- [ ] Write the manual break-detector checklist for each fallback being isolated or removed.
- [ ] Move every remaining undocumented or compatibility-only access path behind small, explicit helper functions.
- [ ] Document why each fallback still exists and what SDK gap it covers.
- [ ] Add/update `requests for ashley.txt` for any fallback that should become unnecessary with an SDK addition.
- [ ] If needed, add a temporary parity probe around a fallback boundary, then remove it after validation.

### Pass 12 — Final cleanup + guardrails
- [ ] Write the final approved SDK2 surface list before deleting the last temporary helpers.
- [ ] Write the final regression checklist before deleting the last temporary helpers.
- [ ] Remove dead helpers, dead probes, and obsolete compatibility branches made unnecessary by earlier passes.
- [ ] Add a short developer note listing the approved SDK2 call surfaces we intentionally rely on.
- [ ] Add grep-based guardrails/checklist notes so future edits do not reintroduce the same mixed-case probing patterns.
- [ ] Perform a final regression pass covering self-draw, non-self-draw, legacy import/repair, and key gameplay timing cases.

## Exit criteria
- The working `scml2/` runtime still behaves like the current good build in manual C3 testing.
- Direct documented SDK v2 calls are the default path in cleaned subsystems.
- Remaining fallbacks are deliberate, isolated, and documented.
- Any still-missing SDK functionality is captured in `requests for ashley.txt`.
