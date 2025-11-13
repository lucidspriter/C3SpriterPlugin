import { isPromiseLike, normaliseProjectFileName } from "./project-utils.js";

const C3 = globalThis.C3;

const PROPERTY_INDEX = Object.freeze({
        SCML_FILE: 0,
        STARTING_ENTITY: 1,
        STARTING_ANIMATION: 2,
        STARTING_OPACITY: 3,
        DRAW_SELF: 4,
        NICKNAME: 5,
        BLEND_MODE: 6
});

const DRAW_SELF_OPTIONS = ["false", "true"];
const BLEND_MODE_OPTIONS = ["no premultiplied alpha blend", "use effects blend mode"];

function toStringOrEmpty(value)
{
        if (typeof value === "string")
        {
                return value;
        }

        if (value == null)
        {
                return "";
        }

        return String(value);
}

function toNumberOrDefault(value, defaultValue)
{
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function normaliseComboValue(value, options, defaultIndex = 0)
{
        if (typeof value === "number" && Number.isInteger(value))
        {
                if (value >= 0 && value < options.length)
                {
                        return value;
                }
        }

        if (typeof value === "string")
        {
                const trimmed = value.trim();
                const lowerCased = trimmed.toLowerCase();

                for (let i = 0, len = options.length; i < len; i++)
                {
                        if (options[i].toLowerCase() === lowerCased)
                        {
                                return i;
                        }
                }

                const numericValue = Number(trimmed);

                if (Number.isInteger(numericValue) && numericValue >= 0 && numericValue < options.length)
                {
                        return numericValue;
                }
        }

        return defaultIndex;
}

function normaliseLegacyRuntimeProperties(initialProperties)
{
        const source = Array.isArray(initialProperties) ? initialProperties : [];
        const normalised = [...source];

        normalised[PROPERTY_INDEX.SCML_FILE] = toStringOrEmpty(source[PROPERTY_INDEX.SCML_FILE]);
        normalised[PROPERTY_INDEX.STARTING_ENTITY] = toStringOrEmpty(source[PROPERTY_INDEX.STARTING_ENTITY]);
        normalised[PROPERTY_INDEX.STARTING_ANIMATION] = toStringOrEmpty(source[PROPERTY_INDEX.STARTING_ANIMATION]);
        normalised[PROPERTY_INDEX.STARTING_OPACITY] = toNumberOrDefault(source[PROPERTY_INDEX.STARTING_OPACITY], 100);
        normalised[PROPERTY_INDEX.DRAW_SELF] = normaliseComboValue(source[PROPERTY_INDEX.DRAW_SELF], DRAW_SELF_OPTIONS, 0);
        normalised[PROPERTY_INDEX.NICKNAME] = toStringOrEmpty(source[PROPERTY_INDEX.NICKNAME]);
        normalised[PROPERTY_INDEX.BLEND_MODE] = normaliseComboValue(source[PROPERTY_INDEX.BLEND_MODE], BLEND_MODE_OPTIONS, 1);

        return normalised;
}

C3.Plugins.Spriter.Instance = class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
        constructor()
        {
                super();

                const properties = this._getInitProperties();
                this._initialProperties = properties ? [...properties] : [];

                this.properties = normaliseLegacyRuntimeProperties(this._initialProperties);

                this.lastData = "";
                this.progress = 0;

                this.entityIndex = -1;
                this.entity = null;
                this.entities = [];

                this.currentAnimation = null;
                this.currentAnimationIndex = -1;
                this.currentAnimationName = "";

                this.currentSpriterTime = 0;
                this.currentAdjustedTime = 0;
                this.secondTime = 0;

                this.start_time = 0;
                this.lastKnownTime = 0;

                const runtime = (typeof this.GetRuntime === "function") ? this.GetRuntime() : null;
                if (runtime && typeof runtime.GetWallTime === "function")
                {
                        this.start_time = runtime.GetWallTime();
                        this.lastKnownTime = this.start_time;
                }

                this.drawSelf = false;
                this.ignoreGlobalTimeScale = false;

                this.NoPremultiply = this.properties[PROPERTY_INDEX.BLEND_MODE] === 0;

                this.appliedCharMaps = [];
                this.doGetFromPreload = false;

                this._projectFileName = "";
                this._rawSpriterProject = null;
                this._projectDataPromise = null;
                this._projectDataLoadError = null;
                this._isProjectDataReady = false;

                this._managedTextures = new Set();
                this._registeredTimelines = new Set();
                this._eventListenerDisposables = new Set();
                this._isReleased = false;
                this._hasShownBlendWarning = false;

                this._currentMainlineKeyIndex = -1;
                this._currentMainlineKey = null;
                this._currentBoneStates = [];
                this._currentObjectStates = [];
                this._timelineStateCache = new Map();
                this._foldersById = new Map();
                this._atlasFrameCache = new Map();
        }

        _release()
        {
                if (!this._isReleased)
                {
                        this._isReleased = true;

                        this._removeRuntimeEventListeners();
                        this._disposeRegisteredTimelines();
                        this._releaseManagedTextures();
                        this._clearAnimationStateCaches();
                        this._clearProjectDataReferences();

                        this._managedTextures = null;
                        this._registeredTimelines = null;
                        this._eventListenerDisposables = null;
                        this._foldersById = null;
                        this._atlasFrameCache = null;
                }

                super._release();
        }

        _onCreate()
        {
                this._initialiseLegacyRuntimeState();
                this._loadProjectDataIfNeeded();
        }

        _initialiseLegacyRuntimeState()
        {
                this.COMPONENTANGLE = "0";
                this.COMPONENTX = "1";
                this.COMPONENTY = "2";
                this.COMPONENTSCALEX = "3";
                this.COMPONENTSCALEY = "4";
                this.COMPONENTIMAGE = "5";
                this.COMPONENTPIVOTX = "6";
                this.COMPONENTPIVOTY = "7";
                this.COMPONENTENTITY = "8";
                this.COMPONENTANIMATION = "9";
                this.COMPONENTTIMERATIO = "10";

                this.nodeStack = [];
                this.isDestroyed = false;
                this.folders = [];
                this.tagDefs = [];

                this.currentAnimation = null;
                this.secondAnimation = null;
                this.animBlend = 0.0;
                this.blendStartTime = 0.0;
                this.blendEndTime = 0.0;
                this.blendPoseTime = 0.0;

                this.lastKnownInstDataAsObj = null;
                this.lastZ = null;
                this.c2ObjectArray = [];
                this.objectArray = [];
                this.boneWidthArray = {};
                this.boneIkOverrides = {};
                this.objectOverrides = {};
                this.objInfoVarDefs = [];
                this.animPlaying = true;
                this.speedRatio = 1.0;

                this.setLayersForSprites = true;
                this.setVisibilityForObjects = true;
                this.setCollisionsForObjects = true;

                const worldInfo = (typeof this.GetWorldInfo === "function") ? this.GetWorldInfo() : null;
                const worldWidth = (worldInfo && typeof worldInfo.GetWidth === "function") ? worldInfo.GetWidth() : 50.0;
                this.scaleRatio = worldWidth / 50.0;
                this.subEntScaleX = 1.0;
                this.subEntScaleY = 1.0;
                this.xFlip = false;
                this.yFlip = false;
                this.playTo = -1;
                this.changeToStartFrom = 0;

                if (typeof this._StartTicking === "function")
                {
                        this._StartTicking();
                }

                if (typeof this._StartTicking2 === "function")
                {
                        this._StartTicking2();
                }

                this.startingEntName = null;
                this.startingAnimName = null;
                this.startingLoopType = null;

                this.leftBuffer = 0;
                this.rightBuffer = 0;
                this.topBuffer = 0;
                this.bottomBuffer = 0;

                this.PAUSENEVER = 0;
                this.PAUSEALLOUTSIDEBUFFER = 1;
                this.PAUSEALLBUTSOUNDOUTSIDEBUFFER = 2;
                this.pauseWhenOutsideBuffer = this.PAUSENEVER;
                this.loadingScon = false;

                this.PLAYFROMSTART = 0;
                this.PLAYFROMCURRENTTIME = 1;
                this.PLAYFROMCURRENTTIMERATIO = 2;
                this.BLENDTOSTART = 3;
                this.BLENDATCURRENTTIMERATIO = 4;

                this.soundToTrigger = "";
                this.soundLineToTrigger = {};
                this.eventToTrigger = "";
                this.eventLineToTrigger = {};

                this.lastFoundObject = "";
                this.objectsToSet = [];

                this.drawSelf = this.properties[PROPERTY_INDEX.DRAW_SELF] === 1;
                this.NoPremultiply = this.properties[PROPERTY_INDEX.BLEND_MODE] === 0;

                const normalisedProjectFile = normaliseProjectFileName(this.properties[PROPERTY_INDEX.SCML_FILE]);
                this.properties[PROPERTY_INDEX.SCML_FILE] = normalisedProjectFile;

                this.force = false;
                this.inAnimTrigger = false;
                this.changeAnimTo = null;

                if (worldInfo && typeof worldInfo.SetOpacity === "function")
                {
                        const startingOpacity = this.properties[PROPERTY_INDEX.STARTING_OPACITY];
                        const opacityRatio = Number.isFinite(startingOpacity) ? startingOpacity / 100.0 : 1.0;
                        const clampedOpacity = Math.min(1.0, Math.max(0.0, opacityRatio));
                        worldInfo.SetOpacity(clampedOpacity);
                }
        }

        _loadProjectDataIfNeeded()
        {
                if (isPromiseLike(this._projectDataPromise) || this._isProjectDataReady)
                {
                        return;
                }

                const sdkType = (typeof this.GetSdkType === "function") ? this.GetSdkType() : null;
                const runtime = (typeof this.GetRuntime === "function") ? this.GetRuntime() : null;
                const projectFileName = normaliseProjectFileName(this.properties[PROPERTY_INDEX.SCML_FILE]);

                if (!projectFileName)
                {
                        this._projectFileName = "";
                        this._rawSpriterProject = null;
                        this._projectDataLoadError = null;
                        this._isProjectDataReady = false;
                        return;
                }

                if (!sdkType || typeof sdkType._requestProjectDataLoad !== "function")
                {
                        this._projectDataLoadError = new Error("Spriter type is missing project data loading support.");
                        return;
                }

                const hasCachedData = (typeof sdkType._hasProjectData === "function") ? sdkType._hasProjectData(projectFileName) : false;

                const loadPromise = sdkType._requestProjectDataLoad(projectFileName, runtime);

                if (!isPromiseLike(loadPromise))
                {
                        if (hasCachedData && typeof sdkType._getCachedProjectData === "function")
                        {
                                const cachedData = sdkType._getCachedProjectData(projectFileName);
                                if (cachedData)
                                {
                                        this._onProjectDataLoaded(projectFileName, cachedData);
                                }
                        }
                        return;
                }

                this._projectDataPromise = loadPromise;

                if (!hasCachedData)
                {
                        this._addRuntimeLoadPromise(loadPromise);
                }

                loadPromise
                        .then((projectData) =>
                        {
                                this._onProjectDataLoaded(projectFileName, projectData);
                        })
                        .catch((error) =>
                        {
                                this._handleProjectDataLoadError(projectFileName, error);
                        });
        }

        _addRuntimeLoadPromise(promise)
        {
                if (!isPromiseLike(promise))
                {
                        return;
                }

                if (typeof this.AddLoadPromise === "function")
                {
                        this.AddLoadPromise(promise);
                        return;
                }

                if (this._runtimeInterface && typeof this._runtimeInterface.AddLoadPromise === "function")
                {
                        this._runtimeInterface.AddLoadPromise(promise);
                        return;
                }

                const runtime = (typeof this.GetRuntime === "function") ? this.GetRuntime() : null;
                if (runtime && typeof runtime.AddLoadPromise === "function")
                {
                        runtime.AddLoadPromise(promise);
                }
        }

        _onProjectDataLoaded(projectFileName, projectData)
        {
                this._projectDataPromise = null;

                if (this.isDestroyed || this._isReleased)
                {
                        return;
                }

                this._projectFileName = projectFileName;
                this._projectDataLoadError = null;
                this._rawSpriterProject = projectData;
                this._isProjectDataReady = true;

                if (projectData && typeof projectData === "object")
                {
                        if (Array.isArray(projectData.folder))
                        {
                                this.folders = this._normaliseFolderDefinitions(projectData.folder);
                        }
                        else
                        {
                                this.folders = [];
                        }

                        this._rebuildFolderIndex();

                        if (Array.isArray(projectData.entity))
                        {
                                this.entities = projectData.entity
                                        .map((entity) => this._normaliseEntityDefinition(entity))
                                        .filter((entity) => entity !== null);
                        }
                        else
                        {
                                this.entities = [];
                        }

                        if (Array.isArray(projectData.tag_list))
                        {
                                this.tagDefs = projectData.tag_list
                                        .map((tag) =>
                                        {
                                                if (tag && typeof tag.name === "string")
                                                {
                                                        return tag.name;
                                                }

                                                if (typeof tag === "string")
                                                {
                                                        return tag;
                                                }

                                                return null;
                                        })
                                        .filter((tagName) => typeof tagName === "string");
                        }
                        else
                        {
                                this.tagDefs = [];
                        }
                }
                else
                {
                        this.folders = [];
                        this._rebuildFolderIndex();
                        this.entities = [];
                        this.tagDefs = [];
                }

                this._applyPendingPlaybackPreferences();
        }

        _handleProjectDataLoadError(projectFileName, error)
        {
                const loadError = error instanceof Error ? error : new Error(String(error));

                this._projectDataPromise = null;

                if (this.isDestroyed || this._isReleased)
                {
                        if (typeof console !== "undefined" && console)
                        {
                                console.error(`[Spriter] Failed to load project '${projectFileName}':`, loadError);
                        }
                        return;
                }

                this._projectFileName = projectFileName;
                this._rawSpriterProject = null;
                this._isProjectDataReady = false;
                this._projectDataLoadError = loadError;
                this.entities = [];
                this.entity = null;
                this.entityIndex = -1;
                this.currentAnimation = null;
                this.currentAnimationIndex = -1;
                this.currentAnimationName = "";

                if (typeof console !== "undefined" && console)
                {
                        console.error(`[Spriter] Failed to load project '${projectFileName}':`, this._projectDataLoadError);
                }
        }

        _registerManagedTexture(texture)
        {
                if (this._isReleased || !texture || !this._managedTextures)
                {
                        return texture;
                }

                this._managedTextures.add(texture);
                return texture;
        }

        _releaseManagedTextures()
        {
                if (!this._managedTextures)
                {
                        return;
                }

                for (const texture of this._managedTextures)
                {
                        this._disposeTextureHandle(texture);
                }

                this._managedTextures.clear();
        }

        _disposeTextureHandle(texture)
        {
                if (!texture)
                {
                        return;
                }

                try
                {
                        if (typeof texture.Release === "function")
                        {
                                texture.Release();
                        }
                        else if (typeof texture.release === "function")
                        {
                                texture.release();
                        }
                        else if (typeof texture.destroy === "function")
                        {
                                texture.destroy();
                        }
                }
                catch (error)
                {
                        this._logCleanupWarning("texture", error);
                }
        }

        _registerTimelineInstance(timeline)
        {
                if (this._isReleased || !timeline || !this._registeredTimelines)
                {
                        return timeline;
                }

                this._registeredTimelines.add(timeline);
                return timeline;
        }

        _disposeRegisteredTimelines()
        {
                if (!this._registeredTimelines)
                {
                        return;
                }

                for (const timeline of this._registeredTimelines)
                {
                        this._disposeTimelineInstance(timeline);
                }

                this._registeredTimelines.clear();
        }

        _disposeTimelineInstance(timeline)
        {
                if (!timeline)
                {
                        return;
                }

                try
                {
                        if (typeof timeline.destroy === "function")
                        {
                                timeline.destroy();
                        }
                        else if (typeof timeline.release === "function")
                        {
                                timeline.release();
                        }
                        else if (typeof timeline.dispose === "function")
                        {
                                timeline.dispose();
                        }
                }
                catch (error)
                {
                        this._logCleanupWarning("timeline", error);
                }
        }

        _registerRuntimeEventListener(target, type, handler, options)
        {
                if (this._isReleased || !this._eventListenerDisposables || !target || !type || typeof handler !== "function")
                {
                        return null;
                }

                let remover = null;

                if (typeof target.addEventListener === "function" && typeof target.removeEventListener === "function")
                {
                        target.addEventListener(type, handler, options);
                        remover = () =>
                        {
                                try
                                {
                                        target.removeEventListener(type, handler, options);
                                }
                                catch (error)
                                {
                                        this._logCleanupWarning(`event listener '${type}'`, error);
                                }
                        };
                }
                else if (typeof target.on === "function" && typeof target.off === "function")
                {
                        target.on(type, handler, options);
                        remover = () =>
                        {
                                try
                                {
                                        target.off(type, handler, options);
                                }
                                catch (error)
                                {
                                        this._logCleanupWarning(`event listener '${type}'`, error);
                                }
                        };
                }
                else if (typeof target.addListener === "function" && typeof target.removeListener === "function")
                {
                        target.addListener(type, handler, options);
                        remover = () =>
                        {
                                try
                                {
                                        target.removeListener(type, handler, options);
                                }
                                catch (error)
                                {
                                        this._logCleanupWarning(`event listener '${type}'`, error);
                                }
                        };
                }

                if (typeof remover === "function")
                {
                        this._eventListenerDisposables.add(remover);
                        return remover;
                }

                return null;
        }

        _removeRuntimeEventListeners()
        {
                if (!this._eventListenerDisposables)
                {
                        return;
                }

                for (const dispose of this._eventListenerDisposables)
                {
                        try
                        {
                                dispose();
                        }
                        catch (error)
                        {
                                this._logCleanupWarning("event listener", error);
                        }
                }

                this._eventListenerDisposables.clear();
        }

        _resetTimelineState()
        {
                this._currentMainlineKeyIndex = -1;
                this._currentMainlineKey = null;

                if (Array.isArray(this._currentBoneStates))
                {
                        this._currentBoneStates.length = 0;
                }
                else
                {
                        this._currentBoneStates = [];
                }

                if (Array.isArray(this._currentObjectStates))
                {
                        this._currentObjectStates.length = 0;
                }
                else
                {
                        this._currentObjectStates = [];
                }

                if (this._timelineStateCache && typeof this._timelineStateCache.clear === "function")
                {
                        this._timelineStateCache.clear();
                }
                else
                {
                        this._timelineStateCache = new Map();
                }
        }

        _clearAnimationStateCaches()
        {
                if (Array.isArray(this.nodeStack))
                {
                        this.nodeStack.length = 0;
                }

                if (Array.isArray(this.appliedCharMaps))
                {
                        this.appliedCharMaps.length = 0;
                }

                if (Array.isArray(this.c2ObjectArray))
                {
                        this.c2ObjectArray.length = 0;
                }

                if (Array.isArray(this.objectArray))
                {
                        this.objectArray.length = 0;
                }

                if (Array.isArray(this.objectsToSet))
                {
                        this.objectsToSet.length = 0;
                }

                this.boneWidthArray = {};
                this.boneIkOverrides = {};
                this.objectOverrides = {};
                this.soundLineToTrigger = {};
                this.eventLineToTrigger = {};
                this.lastFoundObject = "";

                this._resetTimelineState();

                this.currentAnimation = null;
                this.currentAnimationIndex = -1;
                this.currentAnimationName = "";
                this.currentSpriterTime = 0;
                this.currentAdjustedTime = 0;
        }

        _clearProjectDataReferences()
        {
                this._projectFileName = "";
                this._rawSpriterProject = null;
                this._projectDataPromise = null;
                this._projectDataLoadError = null;
                this._isProjectDataReady = false;

                this.folders = [];
                if (this._foldersById)
                {
                        this._foldersById.clear();
                }
                this.entities = [];
                this.entity = null;
                this.entityIndex = -1;
                this.currentAnimation = null;
                this.currentAnimationIndex = -1;
                this.currentAnimationName = "";
                this.currentSpriterTime = 0;
                this.currentAdjustedTime = 0;
                this.tagDefs = [];
                this._hasShownBlendWarning = false;

                if (this._atlasFrameCache)
                {
                        this._atlasFrameCache.clear();
                }
        }

        _logCleanupWarning(resourceType, error)
        {
                if (typeof console !== "undefined" && console && typeof console.warn === "function")
                {
                        console.warn(`[Spriter] Failed to clean up ${resourceType}:`, error);
                }
        }

        _normaliseEntityDefinition(entityDefinition)
        {
                if (!entityDefinition || typeof entityDefinition !== "object")
                {
                        return null;
                }

                const normalised = { ...entityDefinition };
                const animations = [];

                const sourceAnimations = [];

                if (Array.isArray(entityDefinition.animations))
                {
                        sourceAnimations.push(...entityDefinition.animations);
                }
                else if (Array.isArray(entityDefinition.animation))
                {
                        sourceAnimations.push(...entityDefinition.animation);
                }

                for (const animation of sourceAnimations)
                {
                        const normalisedAnimation = this._normaliseAnimationDefinition(animation);
                        if (normalisedAnimation)
                        {
                                animations.push(normalisedAnimation);
                        }
                }

                normalised.animation = animations;
                normalised.animations = animations;
                return normalised;
        }

        _normaliseAnimationDefinition(animationDefinition)
        {
                if (!animationDefinition || typeof animationDefinition !== "object")
                {
                        return null;
                }

                const normalised = { ...animationDefinition };
                normalised.length = this._coerceNumber(animationDefinition.length, 0);
                normalised.looping = animationDefinition.looping;

                const mainlineKeys = this._normaliseMainlineKeys(animationDefinition);
                normalised.mainlineKeys = mainlineKeys;

                const timelines = this._normaliseTimelineDefinitions(animationDefinition.timeline || animationDefinition.timelines);
                normalised.timelines = timelines;

                const timelineMap = new Map();
                for (const timeline of timelines)
                {
                        if (!timeline)
                        {
                                continue;
                        }

                        const timelineId = Number.isInteger(timeline.id) ? timeline.id : timeline.index;
                        timelineMap.set(timelineId, timeline);
                }

                normalised._timelinesById = timelineMap;

                if (!Array.isArray(normalised.soundlines) && Array.isArray(animationDefinition.soundlines))
                {
                        normalised.soundlines = animationDefinition.soundlines;
                }

                if (!Array.isArray(normalised.meta) && animationDefinition.meta)
                {
                        normalised.meta = animationDefinition.meta;
                }

                return normalised;
        }

        _normaliseMainlineKeys(animationDefinition)
        {
                const keys = [];
                if (!animationDefinition)
                {
                        return keys;
                }

                let keySources = [];

                if (Array.isArray(animationDefinition.mainlineKeys))
                {
                        keySources = animationDefinition.mainlineKeys;
                }
                else if (animationDefinition.mainline && typeof animationDefinition.mainline === "object")
                {
                        const mainline = animationDefinition.mainline;
                        if (Array.isArray(mainline.keys))
                        {
                                keySources = mainline.keys;
                        }
                        else if (Array.isArray(mainline.key))
                        {
                                keySources = mainline.key;
                        }
                }

                let fallbackId = 0;
                for (const keyDefinition of keySources)
                {
                        const normalisedKey = this._normaliseMainlineKey(keyDefinition, fallbackId);
                        if (normalisedKey)
                        {
                                fallbackId = normalisedKey.nextFallbackId;
                                keys.push(normalisedKey.key);
                        }
                }

                return keys;
        }

        _normaliseMainlineKey(keyDefinition, fallbackId)
        {
                if (!keyDefinition || typeof keyDefinition !== "object")
                {
                        return null;
                }

                const time = this._coerceNumber(keyDefinition.time, 0);
                const curveTypeSource = keyDefinition.curveType || keyDefinition.curve_type || "linear";
                const curveType = typeof curveTypeSource === "string" ? curveTypeSource : "linear";

                const bones = [];
                const objects = [];

                const boneRefs = Array.isArray(keyDefinition.bones)
                        ? keyDefinition.bones
                        : Array.isArray(keyDefinition.bone_ref)
                                ? keyDefinition.bone_ref
                                : [];

                const objectRefs = Array.isArray(keyDefinition.objects)
                        ? keyDefinition.objects
                        : Array.isArray(keyDefinition.object_ref)
                                ? keyDefinition.object_ref
                                : [];

                let nextFallbackId = fallbackId;

                for (const ref of boneRefs)
                {
                        const { ref: normalisedRef, nextId } = this._normaliseMainlineRef(ref, nextFallbackId);
                        if (normalisedRef)
                        {
                                nextFallbackId = nextId;
                                bones.push(normalisedRef);
                        }
                }

                for (const ref of objectRefs)
                {
                        const { ref: normalisedRef, nextId } = this._normaliseMainlineRef(ref, nextFallbackId);
                        if (normalisedRef)
                        {
                                nextFallbackId = nextId;
                                objects.push(normalisedRef);
                        }
                }

                return {
                        key: {
                                time,
                                curveType,
                                c1: this._coerceNumber(keyDefinition.c1, 0),
                                c2: this._coerceNumber(keyDefinition.c2, 0),
                                c3: this._coerceNumber(keyDefinition.c3, 0),
                                c4: this._coerceNumber(keyDefinition.c4, 0),
                                bones,
                                objects
                        },
                        nextFallbackId
                };
        }

        _normaliseMainlineRef(refDefinition, fallbackId)
        {
                if (!refDefinition || typeof refDefinition !== "object")
                {
                        return { ref: null, nextId: fallbackId };
                }

                const refIdRaw = ("id" in refDefinition) ? Number(refDefinition.id) : NaN;
                const refId = Number.isInteger(refIdRaw) && refIdRaw >= 0 ? refIdRaw : fallbackId;
                const parentRaw = ("parent" in refDefinition) ? Number(refDefinition.parent) : NaN;
                const parent = Number.isInteger(parentRaw) ? parentRaw : -1;
                const timeline = this._coerceNumber(refDefinition.timeline, -1);
                const key = this._coerceNumber(refDefinition.key, 0);

                const normalised = {
                        id: refId,
                        parent,
                        timeline,
                        key,
                        name: typeof refDefinition.name === "string" ? refDefinition.name : ""
                };

                const nextId = refId + 1;
                return { ref: normalised, nextId };
        }

        _normaliseTimelineDefinitions(timelineDefinitions)
        {
                if (!Array.isArray(timelineDefinitions))
                {
                        return [];
                }

                const timelines = [];
                for (let i = 0; i < timelineDefinitions.length; i++)
                {
                        const normalised = this._normaliseTimelineDefinition(timelineDefinitions[i], i);
                        if (normalised)
                        {
                                timelines.push(normalised);
                        }
                }

                return timelines;
        }

        _normaliseTimelineDefinition(timelineDefinition, index)
        {
                if (!timelineDefinition || typeof timelineDefinition !== "object")
                {
                        return null;
                }

                const objectTypeSource = timelineDefinition.objectType || timelineDefinition.object_type || "sprite";
                const objectType = typeof objectTypeSource === "string" ? objectTypeSource : "sprite";
                const timelineIdRaw = ("id" in timelineDefinition) ? Number(timelineDefinition.id) : NaN;
                const timelineId = Number.isInteger(timelineIdRaw) ? timelineIdRaw : index;

                const keysSource = Array.isArray(timelineDefinition.keys)
                        ? timelineDefinition.keys
                        : Array.isArray(timelineDefinition.key)
                                ? timelineDefinition.key
                                : [];

                const keys = [];
                for (let keyIndex = 0; keyIndex < keysSource.length; keyIndex++)
                {
                        const keyDefinition = keysSource[keyIndex];
                        const normalisedKey = this._normaliseTimelineKey(keyDefinition, objectType, keyIndex);
                        if (normalisedKey)
                        {
                                keys.push(normalisedKey);
                        }
                }

                return {
                        id: timelineId,
                        index: index,
                        name: typeof timelineDefinition.name === "string" ? timelineDefinition.name : "",
                        objectType,
                        keys,
                        meta: timelineDefinition.meta || null
                };
        }

        _normaliseTimelineKey(keyDefinition, objectType, keyIndex)
        {
                if (!keyDefinition || typeof keyDefinition !== "object")
                {
                        return null;
                }

                const time = this._coerceNumber(keyDefinition.time, 0);
                const spinRaw = ("spin" in keyDefinition) ? Number(keyDefinition.spin) : NaN;
                const spin = Number.isFinite(spinRaw) ? spinRaw : 1;
                const curveTypeSource = keyDefinition.curveType || keyDefinition.curve_type || "linear";
                const curveType = typeof curveTypeSource === "string" ? curveTypeSource : "linear";

                const key = {
                        index: keyIndex,
                        time,
                        spin,
                        curveType,
                        c1: this._coerceNumber(keyDefinition.c1, 0),
                        c2: this._coerceNumber(keyDefinition.c2, 0),
                        c3: this._coerceNumber(keyDefinition.c3, 0),
                        c4: this._coerceNumber(keyDefinition.c4, 0),
                        objectType
                };

                const objectCandidate = keyDefinition.object || (Array.isArray(keyDefinition.objects) ? keyDefinition.objects[0] : null);
                const boneCandidate = keyDefinition.bone || (Array.isArray(keyDefinition.bones) ? keyDefinition.bones[0] : null);

                if (objectType === "bone" || boneCandidate)
                {
                        key.objectType = "bone";
                        key.bone = this._normaliseTimelineBone(boneCandidate || objectCandidate);
                }
                else
                {
                        key.objectType = objectType;
                        key.object = this._normaliseTimelineObject(objectCandidate);
                }

                return key;
        }

        _normaliseTimelineObject(objectDefinition)
        {
                if (!objectDefinition || typeof objectDefinition !== "object")
                {
                        return null;
                }

                return {
                        x: this._coerceNumber(objectDefinition.x, 0),
                        y: this._coerceNumber(objectDefinition.y, 0),
                        angle: this._coerceNumber(objectDefinition.angle, 0),
                        scaleX: this._coerceNumber(objectDefinition.scaleX ?? objectDefinition.scale_x, 1),
                        scaleY: this._coerceNumber(objectDefinition.scaleY ?? objectDefinition.scale_y, 1),
                        pivotX: this._coerceNumber(objectDefinition.pivotX ?? objectDefinition.pivot_x, this._coerceNumber(objectDefinition.defaultPivotX, 0)),
                        pivotY: this._coerceNumber(objectDefinition.pivotY ?? objectDefinition.pivot_y, this._coerceNumber(objectDefinition.defaultPivotY, 0)),
                        alpha: this._coerceNumber(objectDefinition.a ?? objectDefinition.alpha, 1),
                        folder: this._coerceNumber(objectDefinition.folder, -1),
                        file: this._coerceNumber(objectDefinition.file, -1),
                        entity: this._coerceNumber(objectDefinition.entity, -1),
                        animation: this._coerceNumber(objectDefinition.animation, -1)
                };
        }

        _normaliseTimelineBone(boneDefinition)
        {
                if (!boneDefinition || typeof boneDefinition !== "object")
                {
                        return null;
                }

                return {
                        x: this._coerceNumber(boneDefinition.x, 0),
                        y: this._coerceNumber(boneDefinition.y, 0),
                        angle: this._coerceNumber(boneDefinition.angle, 0),
                        scaleX: this._coerceNumber(boneDefinition.scaleX ?? boneDefinition.scale_x, 1),
                        scaleY: this._coerceNumber(boneDefinition.scaleY ?? boneDefinition.scale_y, 1)
                };
        }

        _applyPendingPlaybackPreferences()
        {
                if (!Array.isArray(this.entities) || this.entities.length === 0)
                {
                        this._setActiveEntity(null, -1);
                        return;
                }

                const entityPreference = this.startingEntName || this.properties[PROPERTY_INDEX.STARTING_ENTITY];
                if (!this._setActiveEntityByName(entityPreference))
                {
                        const numericPreference = Number(entityPreference);
                        if (!Number.isInteger(numericPreference) || !this._setActiveEntityByIndex(numericPreference))
                        {
                                this._setActiveEntityByIndex(0);
                        }
                }

                const animationPreference = this.startingAnimName || this.properties[PROPERTY_INDEX.STARTING_ANIMATION];
                if (!this._setAnimation(animationPreference, 0, 0))
                {
                        const fallbackAnimation = this._getFallbackAnimationName();
                        if (fallbackAnimation)
                        {
                                this._setAnimation(fallbackAnimation, 0, 0);
                        }
                }
        }

        _getRuntime()
        {
                return (typeof this.GetRuntime === "function") ? this.GetRuntime() : null;
        }

        _getNowTime()
        {
                const runtime = this._getRuntime();
                if (runtime && typeof runtime.GetWallTime === "function")
                {
                        return runtime.GetWallTime();
                }

                if (typeof performance !== "undefined" && performance && typeof performance.now === "function")
                {
                        return performance.now() / 1000;
                }

                return Date.now() / 1000;
        }

        _getRuntimeTimeScale()
        {
                if (this.ignoreGlobalTimeScale)
                {
                        return 1;
                }

                if (typeof this.GetTimeScale === "function")
                {
                        const instanceTimeScale = this.GetTimeScale();
                        if (Number.isFinite(instanceTimeScale) && instanceTimeScale >= 0 && instanceTimeScale !== -1)
                        {
                                return instanceTimeScale;
                        }
                }

                const runtime = this._getRuntime();
                if (runtime && typeof runtime.GetTimeScale === "function")
                {
                        const timeScale = runtime.GetTimeScale();
                        if (Number.isFinite(timeScale))
                        {
                                return timeScale;
                        }
                }

                return 1;
        }

        _getAnimationsForEntity(entity)
        {
                if (!entity || typeof entity !== "object")
                {
                        return [];
                }

                if (Array.isArray(entity.animations))
                {
                        return entity.animations;
                }

                if (Array.isArray(entity.animation))
                {
                        return entity.animation;
                }

                return [];
        }

        _findEntity(identifier)
        {
                const entities = Array.isArray(this.entities) ? this.entities : [];
                if (!entities.length)
                {
                        return { entity: null, index: -1 };
                }

                if (typeof identifier === "number" && Number.isInteger(identifier))
                {
                        for (let i = 0; i < entities.length; i++)
                        {
                                const candidate = entities[i];
                                if (candidate && typeof candidate.id === "number" && candidate.id === identifier)
                                {
                                        return { entity: candidate, index: i };
                                }
                        }

                        if (identifier >= 0 && identifier < entities.length)
                        {
                                return { entity: entities[identifier], index: identifier };
                        }
                }

                if (typeof identifier === "string")
                {
                        const trimmed = identifier.trim();
                        if (trimmed)
                        {
                                const numeric = Number(trimmed);
                                if (Number.isInteger(numeric))
                                {
                                        for (let i = 0; i < entities.length; i++)
                                        {
                                                const candidate = entities[i];
                                                if (candidate && typeof candidate.id === "number" && candidate.id === numeric)
                                                {
                                                        return { entity: candidate, index: i };
                                                }
                                        }

                                        if (numeric >= 0 && numeric < entities.length)
                                        {
                                                return { entity: entities[numeric], index: numeric };
                                        }
                                }

                                const lower = trimmed.toLowerCase();
                                for (let i = 0; i < entities.length; i++)
                                {
                                        const candidate = entities[i];
                                        if (candidate && typeof candidate.name === "string" && candidate.name.trim().toLowerCase() === lower)
                                        {
                                                return { entity: candidate, index: i };
                                        }
                                }
                        }
                }

                return { entity: null, index: -1 };
        }

        _setActiveEntityByName(identifier)
        {
                if (identifier == null || identifier === "")
                {
                        return false;
                }

                const { entity, index } = this._findEntity(identifier);
                if (!entity)
                {
                        return false;
                }

                this._setActiveEntity(entity, index);
                return true;
        }

        _setActiveEntityByIndex(index)
        {
                const entities = Array.isArray(this.entities) ? this.entities : [];
                if (!Number.isInteger(index) || index < 0 || index >= entities.length)
                {
                        return false;
                }

                this._setActiveEntity(entities[index], index);
                return true;
        }

        _setActiveEntity(entity, index)
        {
                if (!entity)
                {
                        this.entity = null;
                        this.entityIndex = -1;
                        this.currentAnimation = null;
                        this.currentAnimationIndex = -1;
                        this.currentAnimationName = "";
                        this.currentSpriterTime = 0;
                        this.currentAdjustedTime = 0;
                        this._resetTimelineState();
                        return false;
                }

                this.entity = entity;
                if (Array.isArray(this.entities))
                {
                        if (Number.isInteger(index) && index >= 0 && index < this.entities.length)
                        {
                                this.entityIndex = index;
                        }
                        else
                        {
                                this.entityIndex = this.entities.indexOf(entity);
                        }
                }
                else
                {
                        this.entityIndex = -1;
                }

                this.currentAnimation = null;
                this.currentAnimationIndex = -1;
                this.currentAnimationName = "";
                this.currentSpriterTime = 0;
                this.currentAdjustedTime = 0;
                this._resetTimelineState();

                if (entity && typeof entity.name === "string" && entity.name)
                {
                        this.startingEntName = entity.name;
                }

                return true;
        }

        _getFallbackAnimationName()
        {
                const animations = this._getAnimationsForEntity(this.entity);
                if (!animations.length)
                {
                        return "";
                }

                const firstAnimation = animations[0];
                if (firstAnimation && typeof firstAnimation.name === "string")
                {
                        return firstAnimation.name;
                }

                return "";
        }

        _findAnimation(identifier, allowFallback = false)
        {
                const entity = this.entity;
                const animations = this._getAnimationsForEntity(entity);

                if (!animations.length)
                {
                        return { animation: null, index: -1 };
                }

                if (identifier == null || identifier === "")
                {
                        return allowFallback ? { animation: animations[0], index: 0 } : { animation: null, index: -1 };
                }

                if (typeof identifier === "number" && Number.isInteger(identifier))
                {
                        for (let i = 0, len = animations.length; i < len; i++)
                        {
                                const candidate = animations[i];
                                if (candidate && typeof candidate.id === "number" && candidate.id === identifier)
                                {
                                        return { animation: candidate, index: i };
                                }
                        }

                        if (identifier >= 0 && identifier < animations.length)
                        {
                                return { animation: animations[identifier], index: identifier };
                        }
                }

                if (typeof identifier === "string")
                {
                        const trimmed = identifier.trim();
                        if (trimmed)
                        {
                                const numeric = Number(trimmed);
                                if (Number.isInteger(numeric))
                                {
                                        for (let i = 0, len = animations.length; i < len; i++)
                                        {
                                                const candidate = animations[i];
                                                if (candidate && typeof candidate.id === "number" && candidate.id === numeric)
                                                {
                                                        return { animation: candidate, index: i };
                                                }
                                        }

                                        if (numeric >= 0 && numeric < animations.length)
                                        {
                                                return { animation: animations[numeric], index: numeric };
                                        }
                                }

                                const lower = trimmed.toLowerCase();
                                for (let i = 0, len = animations.length; i < len; i++)
                                {
                                        const candidate = animations[i];
                                        if (candidate && typeof candidate.name === "string" && candidate.name.trim().toLowerCase() === lower)
                                        {
                                                return { animation: candidate, index: i };
                                        }
                                }
                        }
                }

                return allowFallback ? { animation: animations[0], index: 0 } : { animation: null, index: -1 };
        }

        _setAnimation(animationIdentifier, startFrom = 0, blendDuration = 0)
        {
                const allowFallback = animationIdentifier == null || animationIdentifier === "";
                const { animation, index } = this._findAnimation(animationIdentifier, allowFallback);

                if (!animation)
                {
                        if (typeof animationIdentifier === "string" && animationIdentifier)
                        {
                                this.startingAnimName = animationIdentifier;
                        }
                        return false;
                }

                if (blendDuration > 0 && !this._hasShownBlendWarning && typeof console !== "undefined" && console && typeof console.warn === "function")
                {
                        console.warn("[Spriter] Animation blending is not yet supported in the SDK v2 runtime. Ignoring blend duration.");
                        this._hasShownBlendWarning = true;
                }

                const previousAnimation = this.currentAnimation;
                const previousLength = this._getAnimationLength(previousAnimation);
                const previousRatio = previousLength > 0 ? Math.max(0, Math.min(1, this.currentSpriterTime / previousLength)) : 0;

                this.currentAnimation = animation;
                this.currentAnimationIndex = index;
                this.currentAnimationName = (animation && typeof animation.name === "string") ? animation.name : "";
                this.startingAnimName = this.currentAnimationName || (typeof animationIdentifier === "string" ? animationIdentifier : "");

                const length = this._getAnimationLength(animation);
                let nextTime = this.currentSpriterTime;

                switch (startFrom)
                {
                        case this.PLAYFROMSTART:
                                nextTime = this.speedRatio >= 0 ? 0 : length;
                                break;
                        case this.PLAYFROMCURRENTTIME:
                                nextTime = Math.max(0, Math.min(length, this.currentSpriterTime));
                                break;
                        case this.PLAYFROMCURRENTTIMERATIO:
                        case this.BLENDATCURRENTTIMERATIO:
                                nextTime = Math.max(0, Math.min(length, previousRatio * length));
                                break;
                        case this.BLENDTOSTART:
                                nextTime = this.speedRatio >= 0 ? 0 : length;
                                break;
                        default:
                                nextTime = Math.max(0, Math.min(length, this.currentSpriterTime));
                                break;
                }

                if (!Number.isFinite(nextTime))
                {
                        nextTime = 0;
                }

                this.currentSpriterTime = nextTime;
                this.currentAdjustedTime = Math.max(0, Math.min(length, this.currentSpriterTime));
                this.lastKnownTime = this._getNowTime();

                this.playTo = -1;
                this.changeToStartFrom = startFrom;
                this.blendStartTime = 0;
                this.blendEndTime = 0;
                this.blendPoseTime = 0;
                this.secondAnimation = null;
                this.animBlend = 0;
                this.changeAnimTo = null;
                this.animPlaying = true;
                this.force = true;

                this._resetTimelineState();
                this._updateWorldBoundsFromAnimation(animation);
                this._updateAnimationState();
                return true;
        }

        _onAnimationFinished(animation)
        {
                // TODO: trigger Construct events once the event system has been ported.
        }

        _updateWorldBoundsFromAnimation(animation)
        {
                if (!animation)
                {
                        return;
                }

                const worldInfo = (typeof this.GetWorldInfo === "function") ? this.GetWorldInfo() : null;
                if (!worldInfo)
                {
                        return;
                }

                const left = this._coerceNumber(animation.l, 0);
                const right = this._coerceNumber(animation.r, left + 1);
                const top = this._coerceNumber(animation.t, 0);
                const bottom = this._coerceNumber(animation.b, top + 1);

                const widthWithoutScale = right - left;
                const heightWithoutScale = bottom - top;

                if (!(Number.isFinite(widthWithoutScale) && widthWithoutScale > 0) || !(Number.isFinite(heightWithoutScale) && heightWithoutScale > 0))
                {
                        return;
                }

                const scaledWidth = widthWithoutScale * this.scaleRatio;
                const scaledHeight = heightWithoutScale * this.scaleRatio;

                if (Number.isFinite(scaledWidth) && scaledWidth > 0 && typeof worldInfo.SetWidth === "function")
                {
                        worldInfo.SetWidth(scaledWidth);
                }

                if (Number.isFinite(scaledHeight) && scaledHeight > 0 && typeof worldInfo.SetHeight === "function")
                {
                        worldInfo.SetHeight(scaledHeight);
                }

                if (Number.isFinite(widthWithoutScale) && widthWithoutScale !== 0 && typeof worldInfo.SetOriginX === "function")
                {
                        const offsetX = this.xFlip ? -right : left;
                        worldInfo.SetOriginX(-(offsetX) / widthWithoutScale);
                }

                if (Number.isFinite(heightWithoutScale) && heightWithoutScale !== 0 && typeof worldInfo.SetOriginY === "function")
                {
                        const offsetY = this.yFlip ? -bottom : top;
                        worldInfo.SetOriginY(-(offsetY) / heightWithoutScale);
                }

                if (typeof worldInfo.SetBboxChanged === "function")
                {
                        worldInfo.SetBboxChanged();
                }
        }

        _coerceNumber(value, fallback = 0)
        {
                const numberValue = Number(value);
                return Number.isFinite(numberValue) ? numberValue : fallback;
        }

        _getAnimationLength(animation)
        {
                if (!animation || typeof animation !== "object")
                {
                        return 0;
                }

                const length = Number(animation.length);
                return Number.isFinite(length) && length >= 0 ? length : 0;
        }

        _isAnimationLooping(animation)
        {
                if (!animation || typeof animation !== "object")
                {
                        return false;
                }

                const looping = animation.looping;
                if (typeof looping === "string")
                {
                        return looping.toLowerCase() !== "false";
                }

                if (typeof looping === "boolean")
                {
                        return looping;
                }

                if (typeof looping === "number")
                {
                        return looping !== 0;
                }

                return true;
        }

        _getCurrentTimeRatio()
        {
                const animation = this.currentAnimation;
                const length = this._getAnimationLength(animation);

                if (length <= 0)
                {
                        return 0;
                }

                return Math.max(0, Math.min(1, this.currentSpriterTime / length));
        }

        _updateAnimationState()
        {
                const animation = this.currentAnimation;
                if (!animation)
                {
                        this._resetTimelineState();
                        return;
                }

                const mainlineKeys = Array.isArray(animation.mainlineKeys) ? animation.mainlineKeys : [];
                if (!mainlineKeys.length)
                {
                        this._resetTimelineState();
                        return;
                }

                const length = this._getAnimationLength(animation);
                const isLooping = this._isAnimationLooping(animation);
                const time = this._clamp(this.currentAdjustedTime, 0, length || 0);

                const mainlineInterval = this._findKeyInterval(mainlineKeys, time, length, isLooping);
                if (!mainlineInterval)
                {
                        this._resetTimelineState();
                        return;
                }

                const { keyIndex, key } = mainlineInterval;
                this._currentMainlineKeyIndex = keyIndex;
                this._currentMainlineKey = key;

                const rootTransform = this._getRootTransform();
                const stateByRefId = new Map();
                const boneStates = [];
                const objectStates = [];

                if (Array.isArray(key.bones))
                {
                        for (const boneRef of key.bones)
                        {
                                const state = this._computeTimelineState(animation, boneRef, time, length, isLooping, stateByRefId, rootTransform, true);
                                if (state)
                                {
                                        boneStates.push(state);
                                        if (Number.isInteger(boneRef && boneRef.id))
                                        {
                                                stateByRefId.set(boneRef.id, state);
                                        }
                                }
                        }
                }

                if (Array.isArray(key.objects))
                {
                        for (const objectRef of key.objects)
                        {
                                const state = this._computeTimelineState(animation, objectRef, time, length, isLooping, stateByRefId, rootTransform, false);
                                if (state)
                                {
                                        objectStates.push(state);
                                        if (Number.isInteger(objectRef && objectRef.id))
                                        {
                                                stateByRefId.set(objectRef.id, state);
                                        }
                                }
                        }
                }

                this._currentBoneStates = boneStates;
                this._currentObjectStates = objectStates;

                if (this._timelineStateCache && typeof this._timelineStateCache.clear === "function")
                {
                        this._timelineStateCache.clear();

                        for (const state of boneStates)
                        {
                                if (Number.isInteger(state.timelineId))
                                {
                                        this._timelineStateCache.set(state.timelineId, state);
                                }
                        }

                        for (const state of objectStates)
                        {
                                if (Number.isInteger(state.timelineId))
                                {
                                        this._timelineStateCache.set(state.timelineId, state);
                                }
                        }
                }
        }

        _computeTimelineState(animation, ref, time, length, isLooping, stateByRefId, rootTransform, isBone)
        {
                if (!ref || typeof ref !== "object")
                {
                        return null;
                }

                const timeline = this._getTimelineFromRef(animation, ref);
                if (!timeline)
                {
                        return null;
                }

                const localState = this._sampleTimelineLocalState(animation, timeline, time, length, isLooping, ref.key);
                if (!localState)
                {
                        return null;
                }

                const parentId = Number.isInteger(ref.parent) ? ref.parent : -1;
                const parentState = parentId >= 0 ? stateByRefId.get(parentId) : null;
                const parentWorld = parentState ? parentState.world : rootTransform;
                const world = this._composeWorldState(localState, parentWorld);

                return {
                        id: Number.isInteger(ref.id) ? ref.id : -1,
                        parentId,
                        timelineId: Number.isInteger(timeline.id) ? timeline.id : timeline.index,
                        timelineName: typeof timeline.name === "string" ? timeline.name : "",
                        objectType: isBone ? "bone" : (timeline.objectType || "sprite"),
                        local: localState,
                        world,
                        folder: localState.folder ?? -1,
                        file: localState.file ?? -1,
                        entity: localState.entity ?? -1,
                        animation: localState.animation ?? -1,
                        pivotX: localState.pivotX ?? 0,
                        pivotY: localState.pivotY ?? 0,
                        alpha: world.alpha ?? 1
                };
        }

        _sampleTimelineLocalState(animation, timeline, time, length, isLooping, keyIndexHint)
        {
                const keys = Array.isArray(timeline.keys) ? timeline.keys : [];
                if (!keys.length)
                {
                        return null;
                }

                const interval = this._findKeyInterval(keys, time, length, isLooping, keyIndexHint);
                if (!interval)
                {
                        return this._cloneTimelineValue(keys[0]);
                }

                const { key, nextKey, keyIndex, nextIndex, t } = interval;

                const fromState = this._cloneTimelineValue(key);
                if (!fromState)
                {
                        return null;
                }

                if (!nextKey || keyIndex === nextIndex || key === nextKey)
                {
                        return fromState;
                }

                const toState = this._cloneTimelineValue(nextKey);
                if (!toState)
                {
                        return fromState;
                }

                const spin = Number.isFinite(key.spin) ? key.spin : 1;
                const curveT = this._applyCurveToT(key, this._clamp(t, 0, 1));
                return this._interpolateObjectState(fromState, toState, curveT, spin, key.objectType === "bone");
        }

        _cloneTimelineValue(key)
        {
                if (!key)
                {
                        return null;
                }

                if (key.objectType === "bone")
                {
                        return key.bone ? { ...key.bone } : null;
                }

                return key.object ? { ...key.object } : null;
        }

        _interpolateObjectState(a, b, t, spin, isBone)
        {
                const from = a ? { ...a } : null;
                const to = b ? { ...b } : null;

                if (!from && !to)
                {
                        return null;
                }

                if (!from)
                {
                        return to;
                }

                if (!to)
                {
                        return from;
                }

                const result = { ...from };

                result.x = this._lerp(from.x ?? 0, to.x ?? 0, t);
                result.y = this._lerp(from.y ?? 0, to.y ?? 0, t);
                result.angle = this._angleLerpDegrees(from.angle ?? 0, to.angle ?? 0, t, spin);
                result.scaleX = this._lerp(from.scaleX ?? 1, to.scaleX ?? 1, t);
                result.scaleY = this._lerp(from.scaleY ?? 1, to.scaleY ?? 1, t);

                if (!isBone)
                {
                        result.pivotX = this._lerp(from.pivotX ?? 0, to.pivotX ?? 0, t);
                        result.pivotY = this._lerp(from.pivotY ?? 0, to.pivotY ?? 0, t);
                        result.alpha = this._lerp(from.alpha ?? 1, to.alpha ?? 1, t);

                        const chooseNext = t >= 0.999;
                        result.folder = chooseNext ? (to.folder ?? from.folder ?? -1) : (from.folder ?? to.folder ?? -1);
                        result.file = chooseNext ? (to.file ?? from.file ?? -1) : (from.file ?? to.file ?? -1);
                        result.entity = chooseNext ? (to.entity ?? from.entity ?? -1) : (from.entity ?? to.entity ?? -1);
                        result.animation = chooseNext ? (to.animation ?? from.animation ?? -1) : (from.animation ?? to.animation ?? -1);
                }

                return result;
        }

        _composeWorldState(local, parent)
        {
                const parentX = this._coerceNumber(parent && parent.x, 0);
                const parentY = this._coerceNumber(parent && parent.y, 0);
                const parentAngle = this._coerceNumber(parent && parent.angle, 0);
                const parentScaleX = this._coerceNumber(parent && parent.scaleX, 1);
                const parentScaleY = this._coerceNumber(parent && parent.scaleY, 1);
                const parentAlpha = this._coerceNumber(parent && parent.alpha, 1);

                const angleRad = this._degreesToRadians(parentAngle);
                const cos = Math.cos(angleRad);
                const sin = Math.sin(angleRad);

                const localX = this._coerceNumber(local.x, 0) * parentScaleX;
                const localY = this._coerceNumber(local.y, 0) * parentScaleY;

                const rotatedX = localX * cos - localY * sin;
                const rotatedY = localX * sin + localY * cos;

                const worldAngle = this._normaliseAngleDegrees(parentAngle + this._coerceNumber(local.angle, 0));

                return {
                        x: parentX + rotatedX,
                        y: parentY + rotatedY,
                        angle: worldAngle,
                        scaleX: parentScaleX * this._coerceNumber(local.scaleX, 1),
                        scaleY: parentScaleY * this._coerceNumber(local.scaleY, 1),
                        alpha: parentAlpha * (local.alpha != null ? local.alpha : 1)
                };
        }

        _getRootTransform()
        {
                const baseScaleX = this._coerceNumber(this.scaleRatio, 1) * this._coerceNumber(this.subEntScaleX, 1);
                const baseScaleY = this._coerceNumber(this.scaleRatio, 1) * this._coerceNumber(this.subEntScaleY, 1);
                const flipX = this.xFlip ? -1 : 1;
                const flipY = this.yFlip ? -1 : 1;

                const worldInfo = (typeof this.GetWorldInfo === "function") ? this.GetWorldInfo() : null;
                const baseX = (worldInfo && typeof worldInfo.GetX === "function") ? worldInfo.GetX() : 0;
                const baseY = (worldInfo && typeof worldInfo.GetY === "function") ? worldInfo.GetY() : 0;
                const baseAngle = (worldInfo && typeof worldInfo.GetAngle === "function") ? worldInfo.GetAngle() : 0;
                const baseAlpha = (worldInfo && typeof worldInfo.GetOpacity === "function") ? worldInfo.GetOpacity() : 1;

                return {
                        x: baseX,
                        y: baseY,
                        angle: baseAngle,
                        scaleX: baseScaleX * flipX,
                        scaleY: baseScaleY * flipY,
                        alpha: baseAlpha
                };
        }

        _findKeyInterval(keys, time, length, isLooping, keyIndexHint)
        {
                if (!Array.isArray(keys) || !keys.length)
                {
                        return null;
                }

                const animationLength = Number.isFinite(length) ? Math.max(length, 0) : 0;
                const currentTime = Number.isFinite(time) ? time : 0;

                let startIndex = -1;

                if (Number.isInteger(keyIndexHint) && keyIndexHint >= 0 && keyIndexHint < keys.length)
                {
                        startIndex = keyIndexHint;
                }

                if (startIndex === -1)
                {
                        for (let i = keys.length - 1; i >= 0; i--)
                        {
                                const candidate = keys[i];
                                if (!candidate)
                                {
                                        continue;
                                }

                                const candidateTime = this._coerceNumber(candidate.time, 0);
                                if (currentTime >= candidateTime)
                                {
                                        startIndex = i;
                                        break;
                                }
                        }

                        if (startIndex === -1)
                        {
                                startIndex = 0;
                        }
                }

                const key = keys[startIndex];
                if (!key)
                {
                        return null;
                }

                let nextIndex = startIndex + 1;
                if (nextIndex >= keys.length)
                {
                        nextIndex = isLooping ? 0 : startIndex;
                }

                const nextKey = keys[nextIndex] || key;
                const keyTime = this._coerceNumber(key.time, 0);
                let nextTime = this._coerceNumber(nextKey.time, keyTime);
                let wrapped = false;

                if (nextIndex <= startIndex)
                {
                        nextTime += animationLength;
                        wrapped = true;
                }

                let adjustedTime = currentTime;
                if (isLooping && adjustedTime < keyTime)
                {
                        adjustedTime += animationLength;
                }

                const duration = nextTime - keyTime;
                const rawT = duration > 0 ? this._clamp((adjustedTime - keyTime) / duration, 0, 1) : 0;

                return {
                        keyIndex: startIndex,
                        key,
                        nextIndex,
                        nextKey,
                        keyTime,
                        nextTime,
                        t: rawT,
                        wrapped
                };
        }

        _applyCurveToT(key, t)
        {
                if (!key)
                {
                        return t;
                }

                const curveType = typeof key.curveType === "string" ? key.curveType.toLowerCase() : "linear";

                switch (curveType)
                {
                        case "linear":
                                return t;
                        case "quadratic":
                                return this._qerp(0, this._coerceNumber(key.c1, 0), 1, t);
                        case "cubic":
                                return this._cerp(0, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), 1, t);
                        case "quartic":
                                return this._quartic(0, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), this._coerceNumber(key.c3, 0), 1, t);
                        case "quintic":
                                return this._quintic(0, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), this._coerceNumber(key.c3, 0), this._coerceNumber(key.c4, 0), 1, t);
                        case "bezier":
                                return this._cubicBezierAtTime(t, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), this._coerceNumber(key.c3, 1), this._coerceNumber(key.c4, 1));
                        case "instant":
                                return t >= 1 ? 1 : 0;
                        default:
                                return t;
                }
        }

        _getTimelineFromRef(animation, ref)
        {
                if (!animation || !ref)
                {
                        return null;
                }

                const timelines = Array.isArray(animation.timelines) ? animation.timelines : [];

                if (Number.isInteger(ref.timeline))
                {
                        const map = animation._timelinesById;
                        if (map && typeof map.get === "function" && map.has(ref.timeline))
                        {
                                return map.get(ref.timeline);
                        }

                        if (ref.timeline >= 0 && ref.timeline < timelines.length)
                        {
                                return timelines[ref.timeline];
                        }
                }

                if (typeof ref.timeline === "string")
                {
                        const lower = ref.timeline.toLowerCase();
                        for (const timeline of timelines)
                        {
                                if (timeline && typeof timeline.name === "string" && timeline.name.toLowerCase() === lower)
                                {
                                        return timeline;
                                }
                        }
                }

                return null;
        }

        _lerp(a, b, t)
        {
                return ((b - a) * t) + a;
        }

        _qerp(a, b, c, t)
        {
                return this._lerp(this._lerp(a, b, t), this._lerp(b, c, t), t);
        }

        _cerp(a, b, c, d, t)
        {
                return this._lerp(this._qerp(a, b, c, t), this._qerp(b, c, d, t), t);
        }

        _quartic(a, b, c, d, e, t)
        {
                return this._lerp(this._cerp(a, b, c, d, t), this._cerp(b, c, d, e, t), t);
        }

        _quintic(a, b, c, d, e, f, t)
        {
                return this._lerp(this._quartic(a, b, c, d, e, t), this._quartic(b, c, d, e, f, t), t);
        }

        _cubicBezierAtTime(t, p1x, p1y, p2x, p2y)
        {
                const cx = 3.0 * p1x;
                const bx = 3.0 * (p2x - p1x) - cx;
                const ax = 1.0 - cx - bx;
                const cy = 3.0 * p1y;
                const by = 3.0 * (p2y - p1y) - cy;
                const ay = 1.0 - cy - by;
                return this._solve(ax, bx, cx, ay, by, cy, t, this._solveEpsilon(1.0));
        }

        _sampleCurve(a, b, c, t)
        {
                return ((a * t + b) * t + c) * t;
        }

        _sampleCurveDerivativeX(ax, bx, cx, t)
        {
                return (3.0 * ax * t + 2.0 * bx) * t + cx;
        }

        _solveCurveX(ax, bx, cx, x, epsilon)
        {
                let t2 = x;
                let x2;
                let d2;

                for (let i = 0; i < 8; i++)
                {
                        x2 = this._sampleCurve(ax, bx, cx, t2) - x;
                        if (Math.abs(x2) < epsilon)
                        {
                                return t2;
                        }
                        d2 = this._sampleCurveDerivativeX(ax, bx, cx, t2);
                        if (Math.abs(d2) < 1e-6)
                        {
                                break;
                        }
                        t2 -= x2 / d2;
                }

                let t0 = 0;
                let t1 = 1;
                t2 = x;

                while (t0 < t1)
                {
                        x2 = this._sampleCurve(ax, bx, cx, t2);
                        if (Math.abs(x2 - x) < epsilon)
                        {
                                return t2;
                        }
                        if (x > x2)
                        {
                                t0 = t2;
                        }
                        else
                        {
                                t1 = t2;
                        }
                        t2 = (t1 - t0) * 0.5 + t0;
                }

                return t2;
        }

        _solveEpsilon(duration)
        {
                return 1.0 / (200.0 * duration);
        }

        _solve(ax, bx, cx, ay, by, cy, x, epsilon)
        {
                return this._sampleCurve(ay, by, cy, this._solveCurveX(ax, bx, cx, x, epsilon));
        }

        _degreesToRadians(angle)
        {
                return angle * (Math.PI / 180);
        }

        _radiansToDegrees(radians)
        {
                return radians * (180 / Math.PI);
        }

        _angleDiffRadians(a, b)
        {
                let diff = b - a;

                while (diff < -Math.PI)
                {
                        diff += Math.PI * 2;
                }

                while (diff > Math.PI)
                {
                        diff -= Math.PI * 2;
                }

                return diff;
        }

        _angleLerpDegrees(a, b, t, spin)
        {
                const start = Number.isFinite(a) ? a : 0;
                const end = Number.isFinite(b) ? b : 0;

                if (spin === 0)
                {
                        return this._normaliseAngleDegrees(start);
                }

                const startRad = this._degreesToRadians(start);
                const endRad = this._degreesToRadians(end);
                const diff = this._angleDiffRadians(startRad, endRad);
                const delta = spin === -1 ? diff : -diff;
                const resultRad = startRad + delta * t;
                return this._normaliseAngleDegrees(this._radiansToDegrees(resultRad));
        }

        _normaliseAngleDegrees(angle)
        {
                if (!Number.isFinite(angle))
                {
                        return 0;
                }

                let normalised = angle % 360;
                if (normalised > 180)
                {
                        normalised -= 360;
                }
                else if (normalised < -180)
                {
                        normalised += 360;
                }

                return normalised;
        }

        _clamp(value, min, max)
        {
                if (!Number.isFinite(value))
                {
                        return min;
                }

                return Math.min(max, Math.max(min, value));
        }

        _onDestroy()
        {
                if (this.isDestroyed)
                {
                        return;
                }

                this.isDestroyed = true;

                this._removeRuntimeEventListeners();
                this._disposeRegisteredTimelines();
                this._clearAnimationStateCaches();

                if (typeof this._StopTicking === "function")
                {
                        this._StopTicking();
                }

                if (typeof this._StopTicking2 === "function")
                {
                        this._StopTicking2();
                }
        }

        _draw(renderer)
        {
                if (!this.drawSelf || !renderer)
                {
                        return;
                }

                const objectStates = Array.isArray(this._currentObjectStates) ? this._currentObjectStates : [];
                if (!objectStates.length)
                {
                        return;
                }

                const worldInfo = (typeof this.GetWorldInfo === "function") ? this.GetWorldInfo() : null;
                if (!worldInfo)
                {
                        return;
                }

                if (this.NoPremultiply && typeof renderer.SetNoPremultiplyAlphaBlend === "function")
                {
                        renderer.SetNoPremultiplyAlphaBlend();
                }
                else if (typeof renderer.SetBlendMode === "function" && typeof worldInfo.GetBlendMode === "function")
                {
                        renderer.SetBlendMode(worldInfo.GetBlendMode());
                }

                const geometryQuad = new C3.Quad();
                const uvQuad = new C3.Quad();
                const boundingRect = new C3.Rect();

                const mirrorFactor = this.xFlip ? -1 : 1;
                const flipFactor = this.yFlip ? -1 : 1;

                for (const state of objectStates)
                {
                        if (!state || state.objectType !== "sprite")
                        {
                                continue;
                        }

                        const fileInfo = this._getFileInfo(state.folder, state.file);
                        if (!fileInfo)
                        {
                                continue;
                        }

                        const frame = this._getAtlasFrame(fileInfo.atlasIndex);
                        if (!frame || typeof frame.GetImageInfo !== "function")
                        {
                                continue;
                        }

                        const imageInfo = frame.GetImageInfo();
                        if (!imageInfo)
                        {
                                continue;
                        }

                        const texture = (typeof imageInfo.GetTexture === "function") ? imageInfo.GetTexture() : null;
                        if (!texture || typeof renderer.SetTexture !== "function")
                        {
                                continue;
                        }

                        const textureWidth = this._coerceNumber((typeof imageInfo.GetWidth === "function") ? imageInfo.GetWidth() : imageInfo._width, 0);
                        const textureHeight = this._coerceNumber((typeof imageInfo.GetHeight === "function") ? imageInfo.GetHeight() : imageInfo._height, 0);

                        if (textureWidth <= 0 || textureHeight <= 0)
                        {
                                continue;
                        }

                        const texRect = (typeof imageInfo.GetTexRect === "function") ? imageInfo.GetTexRect() : null;
                        const texLeft = texRect && typeof texRect._left === "number" ? texRect._left : 0;
                        const texTop = texRect && typeof texRect._top === "number" ? texRect._top : 0;
                        const texRight = texRect && typeof texRect._right === "number" ? texRect._right : 1;
                        const texBottom = texRect && typeof texRect._bottom === "number" ? texRect._bottom : 1;

                        const worldState = state.world || {};
                        const localState = state.local || {};

                        const pivotX = (localState.pivotX != null) ? localState.pivotX : fileInfo.pivotX;
                        const pivotY = (localState.pivotY != null) ? localState.pivotY : fileInfo.pivotY;

                        const scaleX = this._coerceNumber(worldState.scaleX, 1);
                        const scaleY = this._coerceNumber(worldState.scaleY, 1);
                        const alpha = Math.min(1, Math.max(0, this._coerceNumber(worldState.alpha, 1)));

                        let angleRad = this._degreesToRadians(this._coerceNumber(worldState.angle, 0));

                        let atlasWidth = fileInfo.atlasW;
                        let atlasHeight = fileInfo.atlasH;

                        if (fileInfo.atlasRotated)
                        {
                                angleRad -= Math.PI / 2;
                                const temp = atlasWidth;
                                atlasWidth = atlasHeight;
                                atlasHeight = temp;
                        }

                        if (mirrorFactor * flipFactor === -1)
                        {
                                angleRad -= Math.PI;

                                if (!fileInfo.atlasRotated)
                                {
                                        angleRad *= -1;
                                        angleRad = Math.PI - angleRad;
                                }
                        }

                        const atlasX = fileInfo.atlasX;
                        const atlasY = fileInfo.atlasY;

                        let uvLeft = atlasX / textureWidth;
                        let uvTop = atlasY / textureHeight;
                        let uvRight = (atlasX + atlasWidth) / textureWidth;
                        let uvBottom = (atlasY + atlasHeight) / textureHeight;

                        if (mirrorFactor === -1)
                        {
                                const swap = uvLeft;
                                uvLeft = uvRight;
                                uvRight = swap;
                        }

                        if (flipFactor === -1)
                        {
                                const swap = uvTop;
                                uvTop = uvBottom;
                                uvBottom = swap;
                        }

                        const uvLeftAbs = this._lerp(texLeft, texRight, uvLeft);
                        const uvRightAbs = this._lerp(texLeft, texRight, uvRight);
                        const uvTopAbs = this._lerp(texTop, texBottom, uvTop);
                        const uvBottomAbs = this._lerp(texTop, texBottom, uvBottom);

                        uvQuad.setRect(uvLeftAbs, uvTopAbs, uvRightAbs, uvBottomAbs);

                        const width = fileInfo.width || fileInfo.atlasW;
                        const height = fileInfo.height || fileInfo.atlasH;

                        const absPivotX = pivotX * width * scaleX;
                        const absPivotY = pivotY * height * scaleY;
                        const reverseAbsPivotX = (1 - pivotX) * width * scaleX;
                        const reverseAbsPivotY = (1 - pivotY) * height * scaleY;

                        const xOff = scaleX * fileInfo.atlasXOff;
                        const yOff = scaleY * fileInfo.atlasYOff;
                        const reverseXOff = scaleX * (width - (fileInfo.atlasXOff + fileInfo.atlasW));
                        const reverseYOff = scaleY * (height - (fileInfo.atlasYOff + fileInfo.atlasH));

                        const baseX = this._coerceNumber(worldState.x, 0);
                        const baseY = this._coerceNumber(worldState.y, 0);

                        if (fileInfo.atlasRotated)
                        {
                                boundingRect.set(baseX, baseY, baseX + (fileInfo.atlasH * scaleY), baseY + (fileInfo.atlasW * scaleX));

                                const offsetX = (mirrorFactor === -1) ? (yOff - absPivotY) : (reverseYOff - reverseAbsPivotY);
                                const offsetY = (flipFactor === -1) ? (reverseXOff - reverseAbsPivotX) : (xOff - absPivotX);

                                boundingRect.offset(offsetX, offsetY);
                        }
                        else
                        {
                                boundingRect.set(baseX, baseY, baseX + (fileInfo.atlasW * scaleX), baseY + (fileInfo.atlasH * scaleY));

                                const offsetX = (mirrorFactor === -1) ? (reverseXOff - reverseAbsPivotX) : (xOff - absPivotX);
                                const offsetY = (flipFactor === -1) ? (reverseYOff - reverseAbsPivotY) : (yOff - absPivotY);

                                boundingRect.offset(offsetX, offsetY);
                        }

                        boundingRect.offset(-baseX, -baseY);
                        geometryQuad.setFromRotatedRect(boundingRect, angleRad);
                        geometryQuad.offset(baseX, baseY);

                        geometryQuad.getBoundingBox(boundingRect);
                        boundingRect.normalize();

                        renderer.SetTexture(texture);

                        if (this.NoPremultiply && typeof renderer.SetOpacity === "function")
                        {
                                renderer.SetOpacity(alpha);
                        }
                        else if (typeof renderer.SetColorRgba === "function")
                        {
                                renderer.SetColorRgba(alpha, alpha, alpha, alpha);
                        }

                        if (typeof renderer.Quad4 === "function")
                        {
                                renderer.Quad4(geometryQuad, uvQuad);
                        }
                        else if (typeof renderer.Quad3 === "function")
                        {
                                renderer.Quad3(geometryQuad, boundingRect);
                        }
                }
        }

        _tick()
        {
                const previousKnownTime = this.lastKnownTime;
                const now = this._getNowTime();
                this.lastKnownTime = now;

                const animation = this.currentAnimation;
                if (!animation)
                {
                        this._resetTimelineState();
                        return;
                }

                const length = this._getAnimationLength(animation);
                if (length <= 0)
                {
                        this.currentSpriterTime = 0;
                        this.currentAdjustedTime = 0;
                        return;
                }

                const previousSpriterTime = this.currentSpriterTime;

                if (this.animPlaying)
                {
                        const deltaSecondsRaw = now - previousKnownTime;
                        const deltaSeconds = Number.isFinite(deltaSecondsRaw) ? Math.max(0, deltaSecondsRaw) : 0;

                        if (deltaSeconds !== 0)
                        {
                                const timeScale = this._getRuntimeTimeScale();
                                const deltaMs = deltaSeconds * 1000 * this.speedRatio * timeScale;

                                if (Number.isFinite(deltaMs) && deltaMs !== 0)
                                {
                                        this.currentSpriterTime += deltaMs;
                                }
                        }
                }

                let animationFinished = false;

                if (Number.isFinite(this.playTo) && this.playTo >= 0)
                {
                        const playTo = this.playTo;
                        if ((previousSpriterTime - playTo) * (this.currentSpriterTime - playTo) < 0 || this.currentSpriterTime === playTo)
                        {
                                this.currentSpriterTime = playTo;
                                this.animPlaying = false;
                                this.playTo = -1;
                                animationFinished = true;
                        }
                }

                if (!animationFinished)
                {
                        if (this.speedRatio >= 0)
                        {
                                if (this.currentSpriterTime >= length)
                                {
                                        if (this._isAnimationLooping(animation))
                                        {
                                                this.currentSpriterTime = this.currentSpriterTime % length;
                                        }
                                        else
                                        {
                                                this.currentSpriterTime = length;
                                                this.animPlaying = false;
                                                animationFinished = true;
                                        }
                                }
                        }
                        else if (this.currentSpriterTime <= 0)
                        {
                                if (this._isAnimationLooping(animation))
                                {
                                        const wrappedTime = ((this.currentSpriterTime % length) + length) % length;
                                        this.currentSpriterTime = wrappedTime;
                                }
                                else
                                {
                                        this.currentSpriterTime = 0;
                                        this.animPlaying = false;
                                        animationFinished = true;
                                }
                        }
                }

                this.currentAdjustedTime = Math.max(0, Math.min(length, this.currentSpriterTime));

                if (animationFinished)
                {
                        this._onAnimationFinished(animation);
                }

                this._updateAnimationState();
        }

        _normaliseFolderDefinitions(folderDefinitions)
        {
                if (!Array.isArray(folderDefinitions))
                {
                        return [];
                }

                const folders = [];

                for (let i = 0; i < folderDefinitions.length; i++)
                {
                        const folder = this._normaliseFolderDefinition(folderDefinitions[i], i);
                        if (folder)
                        {
                                folders.push(folder);
                        }
                }

                return folders;
        }

        _normaliseFolderDefinition(folderDefinition, index)
        {
                if (!folderDefinition || typeof folderDefinition !== "object")
                {
                        return null;
                }

                const folderIdRaw = ("id" in folderDefinition) ? Number(folderDefinition.id) : NaN;
                const folderId = Number.isInteger(folderIdRaw) ? folderIdRaw : index;
                const atlasIndex = this._coerceNumber(folderDefinition.atlas, 0);

                const filesSource = Array.isArray(folderDefinition.file)
                        ? folderDefinition.file
                        : Array.isArray(folderDefinition.files)
                                ? folderDefinition.files
                                : [];

                const files = [];
                const filesById = new Map();

                for (let i = 0; i < filesSource.length; i++)
                {
                        const normalised = this._normaliseFileDefinition(filesSource[i], i, atlasIndex);
                        if (normalised)
                        {
                                files.push(normalised);
                                filesById.set(normalised.id, normalised);
                        }
                }

                return {
                        id: folderId,
                        index,
                        name: typeof folderDefinition.name === "string" ? folderDefinition.name : "",
                        atlasIndex,
                        files,
                        filesById
                };
        }

        _normaliseFileDefinition(fileDefinition, index, fallbackAtlasIndex)
        {
                if (!fileDefinition || typeof fileDefinition !== "object")
                {
                        return null;
                }

                const fileIdRaw = ("id" in fileDefinition) ? Number(fileDefinition.id) : NaN;
                const fileId = Number.isInteger(fileIdRaw) ? fileIdRaw : index;

                const widthFallback = this._coerceNumber(fileDefinition.aw, 0);
                const heightFallback = this._coerceNumber(fileDefinition.ah, 0);

                const width = this._coerceNumber(fileDefinition.width ?? fileDefinition.w, widthFallback);
                const height = this._coerceNumber(fileDefinition.height ?? fileDefinition.h, heightFallback);

                const pivotX = this._coerceNumber(fileDefinition.pivotX ?? fileDefinition.pivot_x, 0);
                let pivotY = this._coerceNumber(fileDefinition.pivotY ?? fileDefinition.pivot_y, 0);

                if (fileDefinition.hasOwnProperty("pivot_y") && !fileDefinition.hasOwnProperty("pivotY"))
                {
                        pivotY = 1 - pivotY;
                }

                const atlasW = this._coerceNumber(fileDefinition.aw, width || widthFallback);
                const atlasH = this._coerceNumber(fileDefinition.ah, height || heightFallback);
                const atlasX = this._coerceNumber(fileDefinition.ax, 0);
                const atlasY = this._coerceNumber(fileDefinition.ay, 0);
                const atlasXOff = this._coerceNumber(fileDefinition.axoff, 0);
                const atlasYOff = this._coerceNumber(fileDefinition.ayoff, 0);

                const atlasRotatedRaw = fileDefinition.arot;
                let atlasRotated = false;

                if (typeof atlasRotatedRaw === "string")
                {
                        atlasRotated = atlasRotatedRaw.toLowerCase() === "true";
                }
                else if (typeof atlasRotatedRaw === "boolean")
                {
                        atlasRotated = atlasRotatedRaw;
                }

                const atlasIndex = this._coerceNumber(fileDefinition.atlas, fallbackAtlasIndex);

                return {
                        id: fileId,
                        index,
                        name: typeof fileDefinition.name === "string" ? fileDefinition.name : "",
                        width,
                        height,
                        pivotX,
                        pivotY,
                        atlasIndex,
                        atlasW,
                        atlasH,
                        atlasX,
                        atlasY,
                        atlasXOff,
                        atlasYOff,
                        atlasRotated
                };
        }

        _rebuildFolderIndex()
        {
                if (!this._foldersById)
                {
                        this._foldersById = new Map();
                }
                else
                {
                        this._foldersById.clear();
                }

                if (!Array.isArray(this.folders))
                {
                        return;
                }

                for (const folder of this.folders)
                {
                        if (!folder)
                        {
                                continue;
                        }

                        const id = Number.isInteger(folder.id) ? folder.id : folder.index;
                        this._foldersById.set(id, folder);
                }
        }

        _getFolder(folderId)
        {
                if (!Array.isArray(this.folders) || this.folders.length === 0)
                {
                        return null;
                }

                if (Number.isInteger(folderId) && this._foldersById && this._foldersById.has(folderId))
                {
                        return this._foldersById.get(folderId);
                }

                if (Number.isInteger(folderId) && folderId >= 0 && folderId < this.folders.length)
                {
                        return this.folders[folderId];
                }

                return null;
        }

        _getFileInfo(folderId, fileId)
        {
                const folder = this._getFolder(Number.isInteger(folderId) ? folderId : this._coerceNumber(folderId, -1));
                if (!folder)
                {
                        return null;
                }

                const filesById = folder.filesById;

                if (filesById && Number.isInteger(fileId) && filesById.has(fileId))
                {
                        return filesById.get(fileId);
                }

                const numericFileId = this._coerceNumber(fileId, -1);
                if (numericFileId >= 0 && numericFileId < folder.files.length)
                {
                        return folder.files[numericFileId];
                }

                return null;
        }

        _getAtlasFrame(atlasIndex)
        {
                if (!Number.isInteger(atlasIndex) || atlasIndex < 0)
                {
                        return null;
                }

                if (!this._atlasFrameCache)
                {
                        this._atlasFrameCache = new Map();
                }

                if (this._atlasFrameCache.has(atlasIndex))
                {
                        return this._atlasFrameCache.get(atlasIndex);
                }

                if (typeof this.GetObjectClass !== "function")
                {
                        return null;
                }

                const objectClass = this.GetObjectClass();
                if (!objectClass || typeof objectClass.GetAnimations !== "function")
                {
                        return null;
                }

                const animations = objectClass.GetAnimations();
                if (!Array.isArray(animations) || animations.length === 0)
                {
                        return null;
                }

                const firstAnimation = animations[0];
                if (!firstAnimation || typeof firstAnimation.GetFrames !== "function")
                {
                        return null;
                }

                const frames = firstAnimation.GetFrames();
                if (!Array.isArray(frames) || atlasIndex >= frames.length)
                {
                        return null;
                }

                const frame = frames[atlasIndex] || null;

                if (frame)
                {
                        this._atlasFrameCache.set(atlasIndex, frame);
                }

                return frame;
        }

        _saveToJson()
        {
                return {
                        // TODO: persist state for savegames.
                };
        }

        _loadFromJson(o)
        {
                // TODO: restore state from savegames.
        }

        _getDebuggerProperties()
        {
                return [];
        }
};
