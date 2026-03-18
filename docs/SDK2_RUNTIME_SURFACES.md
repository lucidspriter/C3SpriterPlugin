# SDK2 Runtime Surfaces

This file defines the approved runtime API surface for `scml2/`.

Primary docs:
- Addon SDK runtime reference: <https://www.construct.net/en/make-games/manuals/addon-sdk/runtime-reference>
- SDK v2 runtime scripts guide: <https://www.construct.net/en/make-games/manuals/addon-sdk/guide/runtime-scripts/sdk-v2>
- `ISDKWorldInstanceBase`: <https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/addon-sdk-interfaces/isdkworldinstancebase>
- `IWorldInstance`: <https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/object-interfaces/iworldinstance>

For `c3runtime` code, use:
- Addon SDK lifecycle/hooks for plugin classes.
- Construct runtime/scripting object APIs for runtime objects.

## Approved direct surfaces

Use these directly in cleaned code paths.

- **Lifecycle/hooks**
  - `_onCreate()`, `_tick()`, `_tick2()`, `_trigger(...)`
  - `_setTicking(true)`, `_setTicking2(true)`
  - `runtime.sdk.updateRender()`

- **Runtime clock**
  - `this.runtime.dtRaw`
  - `this.dt`
  - `this.timeScale`

- **World-instance reads/writes**
  - `this.x`, `this.y`, `this.angle`
  - `this.width`, `this.height`
  - `this.opacity`
  - `this.layer`
  - `this.getBoundingBox()`
  - `this.zElevation`, `this.totalZElevation`

- **Associated child instances**
  - `inst.x`, `inst.y`, `inst.angle`
  - `inst.width`, `inst.height`
  - `inst.opacity`, `inst.zElevation`
  - `inst.moveAdjacentToInstance(...)`
  - `inst.animationFrame`

- **Renderer**
  - `renderer.setBlendMode(...)`
  - `renderer.setAlphaBlendMode()`
  - `renderer.setColorFillMode()`
  - `renderer.setTextureFillMode()`
  - `renderer.setTexture(...)`
  - `renderer.setColorRgba(...)`
  - `renderer.setOpacity(...)`
  - `renderer.resetColor()`
  - `renderer.quad(...)`
  - `renderer.quad3(...)`

- **Assets/textures**
  - `runtime.assets`
  - `assetManager.getProjectFileUrl(...)`
  - `assetManager.fetchJson(...)`
  - `assetManager.fetchBlob(...)`
  - `renderer.createStaticTexture(...)`
  - `runtime.sampling`

## Deliberate compatibility islands

These are the remaining places where mixed probing is still allowed. Do not copy
these patterns into cleaned code paths.

- `scml2/c3runtime/instance.js`
  - `_applySelfDrawBlendMode(renderer)`
    - unresolved runtime `IRenderer` no-premultiply API
  - `_getWorldInfoOf(inst)`
    - unresolved origin write, collision enable/disable, and bbox invalidation surface
  - `_getPairedInstanceByContainer(...)`
  - `_getSdkInstanceOf(...)`
  - `_getIID()` / `_getIIDOfInstance(...)`
  - `_setSpriteFrameByIndex(...)`
  - `_getAtlasFrame(...)`
  - `_tryGetEmbeddedAtlasCompatibilityTexture(...)`

- `scml2/c3runtime/type.js`
  - `_getObjectClass()`
  - `_tryGetFramesFromSource(...)`

If any new compatibility island is added, document it in
`docs/phases/phase-06a-sdk2-api-cleanup.md` and, if it reflects a missing SDK
capability, add or update an entry in `requests for ashley.txt`.

## Guardrails

Before merging runtime API work, review these grep checks:

```bash
rg -n "callFirstMethod\\(" scml2/c3runtime
rg -n 'typeof .*=== "function"' scml2/c3runtime
rg -n 'spriterDebugLog\\(|console\\.debug\\(' scml2
```

Expected result:
- no new hits in cleaned code paths
- any remaining hits stay inside the documented compatibility islands above

## Final regression checklist

Run these manually in Construct after runtime API work:

- self-draw rendering, sampling, blend mode, opacity, and shader clipping
- non-self-draw helper movement, z-elevation, visibility, collision toggles
- legacy repair/reimport flow for old self-draw projects
- immediate create -> set animation -> read `AnimationName`
- `On animation finished` chains
- first-frame event triggers and sound triggers
- point/object expressions while the instance is moving
- IK overrides on multiple instances at different positions
