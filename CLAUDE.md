# Spriter Plugin for Construct 3

## Project Overview
This repository ports the legacy Spriter plugin (`scml/`) to Construct's Addon SDK v2 (`scml2/`).

## Key References
- **Porting guide**: https://www.construct.net/en/make-games/manuals/addon-sdk/guide/porting-addon-sdk-v2
- **Old plugin** (SDK v1 reference): `scml/` folder
- **New plugin** (SDK v2, active work): `scml2/` folder

## File Structure (scml2/)
- `plugin.js` - Editor-side: plugin registration, properties, drag-drop import handler
- `plugin.ts` - Editor-side TypeScript (does NOT have import handler - only plugin.js matters for import)
- `c3runtime/instance.ts` - Runtime: project loading, pose evaluation, rendering, non-self-draw
- `c3runtime/instance.js` - **Must be kept manually in sync with instance.ts** (C3 loads .js at runtime)
- `c3runtime/actions.js` / `actions.ts` - Action implementations
- `c3runtime/conditions.js` / `conditions.ts` - Condition implementations
- `c3runtime/expressions.js` / `expressions.ts` - Expression implementations
- `aces.json` - ACE definitions (action/condition/expression IDs)
- `lang/en-US.json` - Display strings

## SDK v2 API Differences (recurring pain point)
SDK v2 (`ISDKWorldInstanceBase`) uses different method names than SDK v1 (`C3.SDKWorldInstanceBase`).
Known differences and the helper methods we use:
- `GetWorldInfo()` doesn't exist in v2. SDK v2 uses direct properties (`inst.x`, `inst.y`, `inst.angle`, `inst.width`, `inst.height`, `inst.opacity`, `inst.isVisible`). `_getWorldInfoOf(inst)` returns either a real WorldInfo (v1) or an adapter object that maps WorldInfo method calls to direct property access (v2).
- `GetInstances()` vs `getAllInstances()` vs `instances()` (iterator) -> `_getInstancesOf(objType)`
- `GetInstance()` doesn't exist in v2 -> `_getIID()` with fallback chain
- `GetName()` vs `.name` property -> `_getObjectTypeName(objType)`

When encountering a new `X is not a function` error at runtime, it's almost always an SDK v1->v2 method name difference. Add a fallback helper following the existing pattern.

## Two Rendering Modes
1. **Self-draw (atlased)**: Plugin renders all parts as quads directly in `_draw()`. Uses atlas textures.
2. **Non-self-draw**: Each Spriter part maps to a real C3 Sprite instance. Import creates Sprite object types, populates frames, auto-generates event blocks, and creates containers. Runtime applies pose transforms to paired Sprite instances each tick.

## Version Stamps
Both `plugin.js` (editor) and `c3runtime/instance.js` (runtime) log a version stamp on load:
- Editor: `[scml editor: vN]`
- Runtime: `[scml runtime: vN]`

**Every time you change plugin.js or instance.js/ts, increment the version number** so the human
can verify the correct version loaded. C3 caches aggressively — shift-click refresh may not always work.
The `.ts` file should have the same version as `.js`.

## Debugging Tips
- The human is always happy to relay console.log output — just add diagnostics and ask!
- Diagnostic logging currently in `_associateTypeWithName` and a one-time dump in `_applyPoseToInstances`
- Check both .ts AND .js when making changes — they must stay in sync
- If unsure about SDK v2 API surface, log available methods on the object to discover what's there
