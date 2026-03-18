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

#### Pass 6 API translation map
- Context: animation/playback ACE actions in `scml2/c3runtime/actions.js`.
  - Current pattern: every action probes plugin-internal helper methods like `_setAnimation`, `_setPlaybackSpeedRatio`, `_setAnimationLoop`, `_setAnimationTime`, `_pauseAnimation`, `_resumeAnimation`, `_playAnimTo`, `_setEnt`, `_setSecondAnim`, `_stopSecondAnim`, and `_setAnimBlendRatio`.
  - Documented SDK2 call: no runtime SDK probing is needed here; these are plugin-owned instance methods and should be called directly.
  - Notes: the Addon SDK/runtime docs define the ACE runtime surface as methods on the instance; our helper methods are implementation details, not discoverable SDK interfaces.
  - Source: Addon SDK runtime reference + plugin-local runtime implementation contract in `scml2/c3runtime/instance.js`.
- Context: animation/time/looping conditions and expressions in `scml2/c3runtime/conditions.js` and `scml2/c3runtime/expressions.js`.
  - Current pattern: conditions/expressions probe plugin-owned helper methods like `_getAnimationName`, `_getSecondAnimationName`, `_getCurrentTimeRatio`, `_getPlayToTimeLeftMs`, and `_isAnimationLooping`.
  - Documented SDK2 call: no runtime SDK probing is needed; call the plugin-owned helper directly.
  - Notes: this pass only removes guard noise around plugin-local playback helpers. It does not change trigger dispatch or external runtime APIs.
  - Source: Addon SDK runtime reference + plugin-local runtime implementation contract in `scml2/c3runtime/instance.js`.
- Context: pre-ready animation requests and immediate `AnimationName` reads.
  - Current pattern: queue pending animation changes until project/entity data is ready, then report pending/current/starting animation via `_getAnimationName()`.
  - Documented SDK2 call: retain the existing plugin-local `_pendingPreReadyAnimationChange` / `_getAnimationName()` flow.
  - Notes: this behavior is plugin parity logic, not an SDK-discovered surface, so the cleanup here is to preserve it while removing unnecessary defensive wrappers.
  - Source: existing runtime implementation in `scml2/c3runtime/instance.js` plus the validated legacy-parity behavior.

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

#### Pass 7 API translation map
- Context: runtime trigger dispatch from `scml2/c3runtime/instance.js`.
  - Current pattern: guard `_trigger(...)` behind `typeof this._trigger === "function"` and also probe condition method presence before firing.
  - Documented SDK2 call: `this._trigger(C3.Plugins.Spriter.Cnds.SomeTrigger)`.
  - Notes: `_trigger()` is a documented `ISDKInstanceBase` API for firing trigger conditions. In this plugin, `C3.Plugins.Spriter.Cnds` is statically defined, so trigger condition references should be called directly.
  - Source: `ISDKInstanceBase` scripting reference (`_trigger(method)`), Addon SDK runtime reference, and SDK2 porting guide Step 5.
- Context: trigger ordering in runtime playback.
  - Current pattern: fire triggers from plugin-owned helper methods like `_triggerAnimationFinished()`, `_triggerEvent()`, `_triggerSound()`, `_triggerOnReady()`, and `_triggerOnLoadFailed()`.
  - Documented SDK2 call: keep those plugin-local helper methods, but inside them use the documented `_trigger(...)` runtime call directly.
  - Notes: this pass does not change timing order; it only removes defensive runtime probing around the documented trigger API.
  - Source: existing runtime implementation in `scml2/c3runtime/instance.js` plus `ISDKInstanceBase._trigger()`.
- Context: async trigger dispatch.
  - Current pattern: only synchronous `_trigger(...)` is used.
  - Documented SDK2 call: keep synchronous `_trigger(...)` for now.
  - Notes: `_triggerAsync(...)` is documented, but there is no current need to change semantics or event ordering in this pass.
  - Source: `ISDKInstanceBase` scripting reference (`_triggerAsync(method)`).

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

#### Pass 8 API translation map
- Context: resolving picked instances from object-type parameters.
  - Current pattern: probe `GetPickedInstances/getPickedInstances`, `GetFirstPickedInstance/getFirstPickedInstance`, `GetPairedInstance/getPairedInstance`, `GetFirstPicked/getFirstPicked`, and SOL internals.
  - Documented SDK2 call: `objectType.getPickedInstances()`, `objectType.getFirstPickedInstance()`, and `objectType.getPairedInstance(instance)`.
  - Notes: use the documented runtime object-type picking APIs first; keep any remaining legacy/SOL-internal fallback isolated behind the official path.
  - Source: runtime `IObjectType` scripting reference.
- Context: enumerating instances of an object type.
  - Current pattern: probe `GetInstances`, `instances()`, `getAllInstances()`, and `_instances`.
  - Documented SDK2 call: `objectType.instances()` for active/current-layout instances, then `objectType.getAllInstances()` only when the broader set is actually needed.
  - Notes: pairing and per-layout association should prefer `instances()` first.
  - Source: runtime `IObjectType` scripting reference.
- Context: using container pairing to map helper instances back to the current Spriter instance.
  - Current pattern: probe `GetPairedInstance/getPairedInstance` with multiple self-instance candidates, then fall back to sibling scanning.
  - Documented SDK2 call: `objectType.getPairedInstance(instance)`.
  - Notes: keep sibling/internal fallback only as a compatibility tail if the documented pairing path is not sufficient in some runtime context.
  - Source: runtime `IObjectType` scripting reference.

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

#### Pass 9 API translation map
- Context: applying per-tick transforms to associated sprite/box/helper instances.
  - Current pattern: route nearly all child-instance updates through the synthetic world-info adapter (`SetX`, `SetY`, `SetAngle`, `SetWidth`, `SetHeight`, `SetOpacity`, `SetZElevation`, etc.).
  - Documented SDK2 call: use direct runtime world-instance properties on the associated instance (`x`, `y`, `angle`, `width`, `height`, `opacity`, `zElevation`).
  - Notes: this pass should move supported child-instance transform writes to direct runtime properties and leave only unsupported operations on the compatibility path.
  - Source: runtime `IWorldInstance` scripting reference.
- Context: sprite-frame changes in non-self-draw mode.
  - Current pattern: try many legacy/internal setter names before touching direct frame state.
  - Documented SDK2 call: use the sprite instance `animationFrame` property first.
  - Notes: keep any remaining internal fallback isolated only for runtimes where the documented frame property is unavailable.
  - Source: runtime sprite-instance scripting reference.
- Context: helper visibility/collision/origin/bbox updates.
  - Current pattern: use world-info compatibility methods for visibility, collision toggles, origin setters, and bbox invalidation.
  - Documented SDK2 call: direct runtime visibility (`isVisible`) is documented, but collision/origin/bbox-invalidating APIs are still unresolved for this plugin.
  - Notes: leave visibility/collision/origin/bbox cleanup on the compatibility path until those APIs are pinned down more confidently.
  - Source: runtime `IWorldInstance` scripting reference plus existing open questions in `requests for ashley.txt`.

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

#### Pass 10 API translation map
- Context: ACE methods in `actions.js`, `conditions.js`, and `expressions.js` that call plugin-owned runtime helpers.
  - Current pattern: guard helper calls with `typeof this._helper === "function"` and silently return fallback values.
  - Documented SDK2 call: ACE runtime handlers are instance methods; once the plugin runtime helper exists on the instance, call it directly.
  - Notes: these are plugin-internal helper methods, not optional SDK surfaces. If one is missing, it is a plugin bug and should fail loudly during testing instead of being hidden by ACE wrappers.
  - Source: Addon SDK/runtime guide for ACE runtime methods plus this plugin's instance helper implementation in `scml2/c3runtime/instance.js`.
- Context: legacy ACE aliases that duplicate canonical ACE logic.
  - Current pattern: many legacy aliases copy the same helper access or fallback logic again.
  - Documented SDK2 call: keep one canonical ACE implementation and route legacy aliases to it.
  - Notes: this pass should reduce duplicate guard logic so both legacy and non-legacy ACEs exercise the same runtime path.
  - Source: Addon SDK/runtime ACE method structure.
- Context: ACE expressions reading world/object state through plugin helpers.
  - Current pattern: wrap `_getPoseObjectX`, `_getWorldBoundingRect`, `_getWorldZElevation`, `_val`, etc. with helper-existence checks.
  - Documented SDK2 call: call the plugin helper directly and let the helper own fallback/default behavior.
  - Notes: expression defaults should live in the runtime helper or canonical expression body, not in every ACE wrapper.
  - Source: Addon SDK/runtime ACE method structure plus plugin runtime helper definitions in `scml2/c3runtime/instance.js`.

### Pass 11 — Fallback isolation
- [ ] Write the fallback inventory/justification list before moving or deleting compatibility code.
- [ ] Write the manual break-detector checklist for each fallback being isolated or removed.
- [ ] Move every remaining undocumented or compatibility-only access path behind small, explicit helper functions.
- [ ] Document why each fallback still exists and what SDK gap it covers.
- [ ] Add/update `requests for ashley.txt` for any fallback that should become unnecessary with an SDK addition.
- [ ] If needed, add a temporary parity probe around a fallback boundary, then remove it after validation.
  - Break detectors:
    - Legacy self-draw project repaired from embedded atlas data still renders instead of falling back to debug quads.
    - Collision boxes/helpers still enable, disable, and move correctly on old projects that depend on the world-info compatibility path.
    - Multiple same-type instances in containers still associate to the correct helper objects.
    - Non-self-draw sprite-frame swaps still work on runtimes where the documented `animationFrame` path succeeds.

#### Pass 11 fallback inventory
- Context: self-draw no-premultiplied alpha blend.
  - Compatibility path: runtime renderer method probing for `setNoPremultiplyAlphaBlend` / `SetNoPremultiplyAlphaBlend`.
  - Why it still exists: we have not found a documented runtime `IRenderer` API for no-premultiplied-alpha rendering.
  - Isolated helper: `_applySelfDrawBlendMode(renderer)` in `scml2/c3runtime/instance.js`.
  - Covered by: `requests for ashley.txt` entry `Runtime IRenderer equivalent for no-premultiplied alpha blend`.
- Context: legacy self-draw projects with atlas imagery embedded in the object image/frames instead of project files.
  - Compatibility path: image-info probing through sdk type / sdk instance / world-info / legacy atlas frame access.
  - Why it still exists: the runtime SDK still does not document a supported way to enumerate custom-plugin animation frames or their image infos.
  - Isolated helpers: `_tryGetEmbeddedAtlasCompatibilityTexture(...)`, `_readCompatibilityTextureFromImageInfo(...)`, `_getAtlasFrame(...)` in `scml2/c3runtime/instance.js` and `_getObjectClass()` in `scml2/c3runtime/type.js`.
  - Covered by: `requests for ashley.txt` entry `SDK2 runtime access to custom plugin animation frames / atlas image info`.
- Context: world-instance writes that are still unresolved in SDK2 runtime docs.
  - Compatibility path: `_getWorldInfoOf(inst)` adapter plus targeted fallbacks for origin writes, collision toggles, and bbox invalidation.
  - Why it still exists: origin/hotspot writes, collision enable/disable, and some direct-property setter parity remain unresolved.
  - Isolated helper: `_getWorldInfoOf(inst)` in `scml2/c3runtime/instance.js`.
  - Covered by: `requests for ashley.txt` entries `SDK2 world-instance origin/hotspot write API`, `SDK2 world-instance collision enable/disable API`, and `ISDKWorldInstanceBase direct property setter parity vs. resolved world-info path`.
- Context: SOL/container pairing and instance-surface recovery on legacy/internal shapes.
  - Compatibility path: `_getPairedInstanceByContainer(...)`, `_getSdkInstanceOf(...)`, `_getIID*` helpers, and object-class recovery tails.
  - Why it still exists: the documented runtime object-type path is primary now, but we still need a guarded escape hatch for old projects until those scenarios are fully re-tested.
  - Isolated helpers: `_getPairedInstanceByContainer(...)`, `_getSdkInstanceOf(...)`, `_getIID()`, `_getIIDOfInstance(...)`, `_getObjectClass()` / `_getAtlasFrame(...)`.
  - Covered by: no new Ashley request yet; keep until container/legacy re-tests are complete.
- Context: non-self-draw sprite-frame fallback.
  - Compatibility path: `_setSpriteFrameByIndex(...)` still falls through older/internal frame setter names after trying the documented `animationFrame` property.
  - Why it still exists: some runtimes did not expose a clearly documented sprite-frame setter during earlier testing.
  - Isolated helper: `_setSpriteFrameByIndex(...)` in `scml2/c3runtime/instance.js`.
  - Covered by: indirectly related to the broader runtime API parity uncertainty already logged; promote to a separate Ashley request only if the documented `animationFrame` path proves insufficient in final testing.

### Pass 12 — Final cleanup + guardrails
- [x] Write the final approved SDK2 surface list before deleting the last temporary helpers.
- [x] Write the final regression checklist before deleting the last temporary helpers.
- [x] Remove dead helpers, dead probes, and obsolete compatibility branches made unnecessary by earlier passes.
- [x] Add a short developer note listing the approved SDK2 call surfaces we intentionally rely on.
- [x] Add grep-based guardrails/checklist notes so future edits do not reintroduce the same mixed-case probing patterns.
- [ ] Perform a final regression pass covering self-draw, non-self-draw, legacy import/repair, and key gameplay timing cases.

#### Pass 12 approved runtime surfaces
- Canonical developer note: `docs/SDK2_RUNTIME_SURFACES.md`
- Runtime rule:
  - use Addon SDK lifecycle/hooks for plugin classes
  - use Construct runtime/scripting APIs for runtime objects
- Approved direct surfaces are listed in `docs/SDK2_RUNTIME_SURFACES.md` for:
  - lifecycle/hooks
  - runtime clock
  - world-instance reads/writes
  - associated child instances
  - renderer
  - asset/texture loading

#### Pass 12 remaining compatibility islands
- `scml2/c3runtime/instance.js`
  - `_applySelfDrawBlendMode(renderer)`
  - `_getWorldInfoOf(inst)`
  - `_getPairedInstanceByContainer(...)`
  - `_getSdkInstanceOf(...)`
  - `_getIID()` / `_getIIDOfInstance(...)`
  - `_setSpriteFrameByIndex(...)`
  - `_getAtlasFrame(...)`
  - `_tryGetEmbeddedAtlasCompatibilityTexture(...)`
- `scml2/c3runtime/type.js`
  - `_getObjectClass()`
  - `_tryGetFramesFromSource(...)`

#### Pass 12 guardrails
- Run before merging runtime API work:
  - `rg -n "callFirstMethod\\(" scml2/c3runtime`
  - `rg -n 'typeof .*=== "function"' scml2/c3runtime`
  - `rg -n 'spriterDebugLog\\(|console\\.debug\\(' scml2`
- Review every remaining hit.
- New hits are only acceptable inside the documented compatibility islands.

#### Pass 12 regression checklist
- Self-draw:
  - rendering, opacity, blend mode, sampling, atlas rendering, shader clipping
- Non-self-draw:
  - helper movement, z-elevation, visibility, collision enable/disable, frame swaps
- Legacy:
  - import/reimport/repair flow for old self-draw projects
- Timing/gameplay:
  - create -> set animation -> read `AnimationName`
  - `On animation finished`
  - first-frame event and sound triggers
  - point/object expressions while moving
  - multi-instance IK overrides and helper ownership

## Exit criteria
- The working `scml2/` runtime still behaves like the current good build in manual C3 testing.
- Direct documented SDK v2 calls are the default path in cleaned subsystems.
- Remaining fallbacks are deliberate, isolated, and documented.
- Any still-missing SDK functionality is captured in `requests for ashley.txt`.
