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

                this._animationStateCache = new WeakMap();
                this.currentFrameState = {
                        bones: [],
                        objects: [],
                        mainlineKeyIndex: -1,
                        mainlineKeyTime: 0,
                        adjustedTime: 0
                };
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
                                this.folders = projectData.folder;
                        }

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
                }
                else
                {
                        this.entities = [];
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

                this.currentAnimation = null;
                this.currentAnimationIndex = -1;
                this.currentAnimationName = "";
                this.currentSpriterTime = 0;
                this.currentAdjustedTime = 0;

                this._resetFrameState();
                this._animationStateCache = new WeakMap();
        }

        _clearProjectDataReferences()
        {
                this._projectFileName = "";
                this._rawSpriterProject = null;
                this._projectDataPromise = null;
                this._projectDataLoadError = null;
                this._isProjectDataReady = false;

                this.folders = [];
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

                this._resetFrameState();
                this._animationStateCache = new WeakMap();
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

                if (Array.isArray(entityDefinition.animations))
                {
                        for (const animation of entityDefinition.animations)
                        {
                                if (animation && typeof animation === "object")
                                {
                                        animations.push(animation);
                                }
                        }
                }
                else if (Array.isArray(entityDefinition.animation))
                {
                        for (const animation of entityDefinition.animation)
                        {
                                if (animation && typeof animation === "object")
                                {
                                        animations.push(animation);
                                }
                        }
                }

                normalised.animation = animations;
                normalised.animations = animations;
                return normalised;
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
                        this._resetFrameState();
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

                if (entity && typeof entity.name === "string" && entity.name)
                {
                        this.startingEntName = entity.name;
                }

                this._resetFrameState();
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

        _resetFrameState()
        {
                if (!this.currentFrameState)
                {
                        this.currentFrameState = {
                                bones: [],
                                objects: [],
                                mainlineKeyIndex: -1,
                                mainlineKeyTime: 0,
                                adjustedTime: 0
                        };
                        return;
                }

                if (Array.isArray(this.currentFrameState.bones))
                {
                        this.currentFrameState.bones.length = 0;
                }

                if (Array.isArray(this.currentFrameState.objects))
                {
                        this.currentFrameState.objects.length = 0;
                }

                this.currentFrameState.mainlineKeyIndex = -1;
                this.currentFrameState.mainlineKeyTime = 0;
                this.currentFrameState.adjustedTime = 0;
        }

        _resolveMainlineState(animation, rawTime)
        {
                const length = this._getAnimationLength(animation);
                const isLooping = this._isAnimationLooping(animation);
                const time = this._normaliseTimeWithinAnimation(rawTime, length, isLooping);

                const mainlineKeys = this._getAnimationMainlineKeys(animation);
                if (!mainlineKeys.length)
                {
                        const clampedTime = Math.max(0, Math.min(length, time));
                        return {
                                key: null,
                                index: -1,
                                nextKey: null,
                                nextIndex: -1,
                                ratio: 0,
                                curveRatio: 0,
                                keyTime: 0,
                                nextKeyTime: length,
                                adjustedTime: clampedTime,
                                time,
                                length,
                                isLooping
                        };
                }

                let keyIndex = 0;
                let keyTime = this._coerceNumber(this._getMainlineKeyTime(mainlineKeys[0]), 0);

                for (let i = 0, len = mainlineKeys.length; i < len; i++)
                {
                        const candidate = mainlineKeys[i];
                        const candidateTime = this._coerceNumber(this._getMainlineKeyTime(candidate), 0);
                        if (time >= candidateTime)
                        {
                                keyIndex = i;
                                keyTime = candidateTime;
                        }
                        else
                        {
                                break;
                        }
                }

                const key = mainlineKeys[keyIndex];
                let nextIndex = keyIndex;

                if (mainlineKeys.length > 1)
                {
                        if (keyIndex + 1 < mainlineKeys.length)
                        {
                                nextIndex = keyIndex + 1;
                        }
                        else if (isLooping)
                        {
                                nextIndex = 0;
                        }
                }

                const nextKey = mainlineKeys[nextIndex] || key;
                let nextKeyTime = this._coerceNumber(this._getMainlineKeyTime(nextKey), length);
                let ratio = 0;

                if (nextIndex !== keyIndex)
                {
                        let startTime = keyTime;
                        let endTime = nextKeyTime;
                        let resolvedTime = time;

                        if (endTime < startTime)
                        {
                                endTime += length;
                                if (resolvedTime < startTime)
                                {
                                        resolvedTime += length;
                                }
                        }

                        const span = endTime - startTime;
                        if (span > 0)
                        {
                                ratio = Math.max(0, Math.min(1, (resolvedTime - startTime) / span));
                        }
                }

                const curveRatio = this._getKeyCurveRatio(key, ratio);
                const adjustedRaw = this._lerp(keyTime, nextKeyTime, curveRatio);
                const adjustedTime = this._wrapAnimationTime(adjustedRaw, length, isLooping);

                return {
                        key,
                        index: keyIndex,
                        nextKey,
                        nextIndex,
                        ratio,
                        curveRatio,
                        keyTime,
                        nextKeyTime,
                        adjustedTime,
                        time,
                        length,
                        isLooping
                };
        }

        _updateAnimationFrameState(animation, mainlineState)
        {
                if (!animation || typeof animation !== "object")
                {
                        this._resetFrameState();
                        return;
                }

                const resolvedState = mainlineState || this._resolveMainlineState(animation, this.currentSpriterTime);
                const cache = this._prepareAnimationCache(animation);
                const frameState = this.currentFrameState || {
                        bones: [],
                        objects: [],
                        mainlineKeyIndex: -1,
                        mainlineKeyTime: 0,
                        adjustedTime: 0
                };

                this.currentFrameState = frameState;

                frameState.bones.length = 0;
                frameState.objects.length = 0;
                frameState.mainlineKeyIndex = resolvedState.index;
                frameState.mainlineKeyTime = resolvedState.keyTime;
                frameState.adjustedTime = resolvedState.adjustedTime;

                if (!resolvedState.key)
                {
                        return;
                }

                const length = resolvedState.length;
                const isLooping = resolvedState.isLooping;
                const sampleTime = resolvedState.adjustedTime;

                const boneRefs = this._getMainlineBoneRefs(resolvedState.key);
                const objectRefs = this._getMainlineObjectRefs(resolvedState.key);

                let zIndex = 0;
                for (const ref of boneRefs)
                {
                        const timelineInfo = this._resolveTimelineReference(ref, cache);
                        if (!timelineInfo)
                        {
                                continue;
                        }

                        const sampled = this._sampleTimelineState(timelineInfo, cache, sampleTime, length, isLooping);
                        if (!sampled)
                        {
                                continue;
                        }

                        sampled.parent = this._coerceNumber(ref && ref.parent, -1);
                        sampled.ref = ref;
                        sampled.zIndex = zIndex++;
                        frameState.bones.push(sampled);
                }

                zIndex = 0;
                for (const ref of objectRefs)
                {
                        const timelineInfo = this._resolveTimelineReference(ref, cache);
                        if (!timelineInfo)
                        {
                                continue;
                        }

                        const sampled = this._sampleTimelineState(timelineInfo, cache, sampleTime, length, isLooping);
                        if (!sampled)
                        {
                                continue;
                        }

                        sampled.parent = this._coerceNumber(ref && ref.parent, -1);
                        sampled.ref = ref;
                        sampled.zIndex = zIndex++;
                        frameState.objects.push(sampled);
                }
        }

        _prepareAnimationCache(animation)
        {
                if (!this._animationStateCache)
                {
                        this._animationStateCache = new WeakMap();
                }

                let cache = this._animationStateCache.get(animation);
                if (cache)
                {
                        return cache;
                }

                const mainlineKeys = this._getAnimationMainlineKeys(animation);
                const timelines = this._getAnimationTimelines(animation);

                const timelineInfos = [];
                const timelineInfoById = new Map();
                const timelineByName = new Map();
                const timelineKeysById = new Map();
                const timelineStatesById = new Map();

                for (let i = 0; i < timelines.length; i++)
                {
                        const timeline = timelines[i];
                        if (!timeline || typeof timeline !== "object")
                        {
                                continue;
                        }

                        const id = this._coerceNumber(timeline.id, i);
                        const name = this._getTimelineName(timeline);
                        const objectType = this._getTimelineObjectType(timeline);
                        const defaults = this._getTimelineDefaultObject(timeline);

                        const info = {
                                id,
                                timeline,
                                name,
                                objectType,
                                defaults
                        };

                        timelineInfos.push(info);
                        timelineInfoById.set(id, info);

                        if (typeof name === "string" && name)
                        {
                                timelineByName.set(name.toLowerCase(), info);
                        }

                        const keys = this._getTimelineKeys(timeline);
                        timelineKeysById.set(id, keys);
                }

                cache = {
                        mainlineKeys,
                        timelines,
                        timelineInfos,
                        timelineInfoById,
                        timelineByName,
                        timelineKeysById,
                        timelineStatesById
                };

                this._animationStateCache.set(animation, cache);
                return cache;
        }

        _getAnimationMainlineKeys(animation)
        {
                if (!animation || typeof animation !== "object")
                {
                        return [];
                }

                if (Array.isArray(animation.mainlineKeys))
                {
                        return animation.mainlineKeys;
                }

                if (Array.isArray(animation.mainline))
                {
                        return animation.mainline;
                }

                if (animation.mainline && typeof animation.mainline === "object")
                {
                        const mainline = animation.mainline;
                        if (Array.isArray(mainline.keys))
                        {
                                return mainline.keys;
                        }

                        if (Array.isArray(mainline.key))
                        {
                                return mainline.key;
                        }
                }

                return [];
        }

        _getAnimationTimelines(animation)
        {
                if (!animation || typeof animation !== "object")
                {
                        return [];
                }

                if (Array.isArray(animation.timelines))
                {
                        return animation.timelines;
                }

                if (Array.isArray(animation.timeline))
                {
                        return animation.timeline;
                }

                return [];
        }

        _getTimelineKeys(timeline)
        {
                if (!timeline || typeof timeline !== "object")
                {
                        return [];
                }

                if (Array.isArray(timeline.keys))
                {
                        return timeline.keys;
                }

                if (Array.isArray(timeline.key))
                {
                        return timeline.key;
                }

                return [];
        }

        _getTimelineName(timeline)
        {
                if (!timeline || typeof timeline !== "object")
                {
                        return "";
                }

                if (typeof timeline.name === "string")
                {
                        return timeline.name;
                }

                return "";
        }

        _getTimelineObjectType(timeline)
        {
                if (!timeline || typeof timeline !== "object")
                {
                        return "sprite";
                }

                const type = timeline.objectType ?? timeline.object_type ?? timeline.type;
                if (typeof type === "string" && type)
                {
                        return type;
                }

                return "sprite";
        }

        _getTimelineDefaultObject(timeline)
        {
                if (!timeline || typeof timeline !== "object")
                {
                        return null;
                }

                if (timeline.object && typeof timeline.object === "object")
                {
                        return timeline.object;
                }

                return null;
        }

        _getMainlineKeyTime(key)
        {
                if (!key || typeof key !== "object")
                {
                        return 0;
                }

                return this._coerceNumber(key.time, 0);
        }

        _getMainlineBoneRefs(key)
        {
                if (!key || typeof key !== "object")
                {
                        return [];
                }

                if (Array.isArray(key.bone_ref))
                {
                        return key.bone_ref;
                }

                if (Array.isArray(key.bones))
                {
                        return key.bones;
                }

                return [];
        }

        _getMainlineObjectRefs(key)
        {
                if (!key || typeof key !== "object")
                {
                        return [];
                }

                if (Array.isArray(key.object_ref))
                {
                        return key.object_ref;
                }

                if (Array.isArray(key.objects))
                {
                        return key.objects;
                }

                return [];
        }

        _resolveTimelineReference(ref, cache)
        {
                if (!ref || typeof ref !== "object" || !cache)
                {
                        return null;
                }

                const timelineIdRaw = ref.timeline;
                if (timelineIdRaw != null)
                {
                        const numericId = Number(timelineIdRaw);
                        if (Number.isInteger(numericId) && cache.timelineInfoById.has(numericId))
                        {
                                return cache.timelineInfoById.get(numericId);
                        }

                        if (typeof timelineIdRaw === "string")
                        {
                                const trimmed = timelineIdRaw.trim().toLowerCase();
                                if (trimmed && cache.timelineByName.has(trimmed))
                                {
                                        return cache.timelineByName.get(trimmed);
                                }

                                const parsed = Number(trimmed);
                                if (Number.isInteger(parsed) && cache.timelineInfoById.has(parsed))
                                {
                                        return cache.timelineInfoById.get(parsed);
                                }
                        }
                }

                if (typeof ref.timeline === "string")
                {
                        const trimmed = ref.timeline.trim().toLowerCase();
                        if (trimmed && cache.timelineByName.has(trimmed))
                        {
                                return cache.timelineByName.get(trimmed);
                        }
                }

                if (cache.timelineInfos && cache.timelineInfos.length)
                {
                        return cache.timelineInfos[0] || null;
                }

                return null;
        }

        _sampleTimelineState(timelineInfo, cache, time, length, isLooping)
        {
                if (!timelineInfo || !cache)
                {
                        return null;
                }

                const keys = cache.timelineKeysById.get(timelineInfo.id);
                if (!Array.isArray(keys) || !keys.length)
                {
                        return null;
                }

                const selection = this._findTimelineKeyIndices(keys, time, length, isLooping);
                const currentKey = keys[selection.currentIndex];
                if (!currentKey)
                {
                        return null;
                }

                const baseState = this._normaliseTimelineKeyObject(timelineInfo.timeline, currentKey, timelineInfo.objectType, timelineInfo.defaults);
                if (!baseState)
                {
                        return null;
                }

                let targetState = cache.timelineStatesById.get(timelineInfo.id);
                if (!targetState)
                {
                        targetState = this._createEmptyTimelineState(timelineInfo);
                        cache.timelineStatesById.set(timelineInfo.id, targetState);
                }

                if (selection.nextIndex !== selection.currentIndex)
                {
                        const nextKey = keys[selection.nextIndex];
                        const nextState = this._normaliseTimelineKeyObject(timelineInfo.timeline, nextKey, timelineInfo.objectType, timelineInfo.defaults);
                        if (nextState)
                        {
                                const curveRatio = this._getKeyCurveRatio(currentKey, selection.ratio);
                                const spin = this._getKeySpin(currentKey);
                                this._writeInterpolatedState(targetState, baseState, nextState, curveRatio, spin);
                        }
                        else
                        {
                                this._writeObjectState(targetState, baseState);
                        }
                }
                else
                {
                        this._writeObjectState(targetState, baseState);
                }

                const nextKey = keys[selection.nextIndex] || currentKey;

                targetState.timelineId = timelineInfo.id;
                targetState.timelineName = timelineInfo.name;
                targetState.timeline = timelineInfo.timeline;
                targetState.timelineKeyIndex = selection.currentIndex;
                targetState.timelineKeyId = this._coerceNumber(currentKey && currentKey.id, selection.currentIndex);
                targetState.timelineKeyTime = selection.currentKeyTime;
                targetState.timelineNextKeyIndex = selection.nextIndex;
                targetState.timelineNextKeyId = this._coerceNumber(nextKey && nextKey.id, selection.nextIndex);
                targetState.timelineNextKeyTime = selection.nextKeyTime;
                targetState.spin = this._getKeySpin(currentKey);
                targetState.time = this._normaliseTimeWithinAnimation(time, length, isLooping);

                return targetState;
        }

        _createEmptyTimelineState(timelineInfo)
        {
                return {
                        type: timelineInfo.objectType || "sprite",
                        x: 0,
                        y: 0,
                        angle: 0,
                        scaleX: 1,
                        scaleY: 1,
                        alpha: 1,
                        pivotX: 0,
                        pivotY: 0,
                        folder: -1,
                        file: -1,
                        entity: null,
                        animation: null,
                        t: 0,
                        defaultPivot: false,
                        frame: 0,
                        timelineId: timelineInfo.id,
                        timelineName: timelineInfo.name,
                        timeline: timelineInfo.timeline,
                        spin: 1,
                        timelineKeyIndex: 0,
                        timelineKeyId: 0,
                        timelineKeyTime: 0,
                        timelineNextKeyIndex: 0,
                        timelineNextKeyId: 0,
                        timelineNextKeyTime: 0,
                        time: 0,
                        parent: -1,
                        ref: null,
                        zIndex: 0
                };
        }

        _findTimelineKeyIndices(keys, time, length, isLooping)
        {
                if (!Array.isArray(keys) || !keys.length)
                {
                        return {
                                currentIndex: 0,
                                nextIndex: 0,
                                ratio: 0,
                                currentKeyTime: 0,
                                nextKeyTime: 0
                        };
                }

                const normalisedTime = this._normaliseTimeWithinAnimation(time, length, isLooping);

                let currentIndex = 0;
                let currentKeyTime = this._coerceNumber(keys[0] && keys[0].time, 0);

                for (let i = 0; i < keys.length; i++)
                {
                        const candidate = keys[i];
                        const candidateTime = this._coerceNumber(candidate && candidate.time, 0);
                        if (normalisedTime >= candidateTime)
                        {
                                currentIndex = i;
                                currentKeyTime = candidateTime;
                        }
                        else
                        {
                                break;
                        }
                }

                let nextIndex = currentIndex;
                if (keys.length > 1)
                {
                        if (currentIndex + 1 < keys.length)
                        {
                                nextIndex = currentIndex + 1;
                        }
                        else if (isLooping)
                        {
                                nextIndex = 0;
                        }
                }

                const nextKeyTime = this._coerceNumber(keys[nextIndex] && keys[nextIndex].time, currentKeyTime);

                let ratio = 0;
                if (nextIndex !== currentIndex)
                {
                        let startTime = currentKeyTime;
                        let endTime = nextKeyTime;
                        let adjustedTime = normalisedTime;

                        if (endTime < startTime)
                        {
                                endTime += length;
                                if (adjustedTime < startTime)
                                {
                                        adjustedTime += length;
                                }
                        }

                        const span = endTime - startTime;
                        if (span > 0)
                        {
                                ratio = Math.max(0, Math.min(1, (adjustedTime - startTime) / span));
                        }
                }

                return {
                        currentIndex,
                        nextIndex,
                        ratio,
                        currentKeyTime,
                        nextKeyTime
                };
        }

        _getKeyCurveRatio(key, ratio)
        {
                const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));

                if (!key || typeof key !== "object")
                {
                        return clamped;
                }

                const rawType = typeof key.curve_type === "string" ? key.curve_type : key.curveType;
                const curveType = rawType ? rawType.toLowerCase() : "linear";

                switch (curveType)
                {
                        case "linear":
                                return clamped;
                        case "quadratic":
                                return this._qerp(0, this._coerceNumber(key.c1, 0), 1, clamped);
                        case "cubic":
                                return this._cerp(0, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), 1, clamped);
                        case "quartic":
                                return this._quartic(0, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), this._coerceNumber(key.c3, 0), 1, clamped);
                        case "quintic":
                                return this._quintic(0, this._coerceNumber(key.c1, 0), this._coerceNumber(key.c2, 0), this._coerceNumber(key.c3, 0), this._coerceNumber(key.c4, 0), 1, clamped);
                        case "bezier":
                                return this._cubicBezierAtTime(clamped,
                                        this._coerceNumber(key.c1, 0),
                                        this._coerceNumber(key.c2, 0),
                                        this._coerceNumber(key.c3, 0),
                                        this._coerceNumber(key.c4, 0),
                                        1
                                );
                        case "instant":
                                return clamped >= 1 ? 1 : 0;
                        default:
                                return clamped;
                }
        }

        _getKeySpin(key)
        {
                if (!key || typeof key !== "object")
                {
                        return 1;
                }

                const spin = Number(key.spin);
                if (!Number.isFinite(spin))
                {
                        return 1;
                }

                if (spin === 0)
                {
                        return 0;
                }

                return spin < 0 ? -1 : 1;
        }

        _normaliseTimelineKeyObject(timeline, key, objectType, defaults)
        {
                const source = this._extractTimelineObjectSource(key, objectType);
                if (!source || typeof source !== "object")
                {
                        return null;
                }

                const type = typeof source.type === "string" && source.type ? source.type : (objectType || "sprite");

                const fallbackPivotX = defaults ? this._coerceNumber(defaults.pivotX ?? defaults.pivot_x, NaN) : NaN;
                const fallbackPivotY = defaults ? this._coerceNumber(defaults.pivotY ?? defaults.pivot_y, NaN) : NaN;
                const pivotXRaw = source.pivotX ?? source.pivot_x;
                const pivotYRaw = source.pivotY ?? source.pivot_y;

                let pivotX = this._coerceNumber(pivotXRaw, NaN);
                if (!Number.isFinite(pivotX))
                {
                        pivotX = Number.isFinite(fallbackPivotX) ? fallbackPivotX : 0;
                }

                let pivotY = this._coerceNumber(pivotYRaw, NaN);
                if (!Number.isFinite(pivotY))
                {
                        pivotY = Number.isFinite(fallbackPivotY) ? fallbackPivotY : 0;
                }

                const folderFallback = defaults ? this._coerceNumber(defaults.folder, -1) : -1;
                const fileFallback = defaults ? this._coerceNumber(defaults.file, -1) : -1;

                const defaultPivotRaw = source.useDefaultPivot ?? source.use_default_pivot ?? source.defaultPivot ?? (defaults ? defaults.useDefaultPivot ?? defaults.defaultPivot : false);

                return {
                        type,
                        x: this._coerceNumber(source.x, 0),
                        y: this._coerceNumber(source.y, 0),
                        angle: this._coerceNumber(source.angle, 0),
                        scaleX: this._coerceNumber(source.scaleX ?? source.scale_x, 1),
                        scaleY: this._coerceNumber(source.scaleY ?? source.scale_y, 1),
                        alpha: this._coerceNumber(source.a ?? source.alpha, 1),
                        pivotX,
                        pivotY,
                        folder: this._coerceNumber(source.folder, folderFallback),
                        file: this._coerceNumber(source.file, fileFallback),
                        entity: source.entity ?? (defaults ? defaults.entity : null),
                        animation: source.animation ?? (defaults ? defaults.animation : null),
                        t: this._coerceNumber(source.t, this._coerceNumber(defaults ? defaults.t : 0, 0)),
                        defaultPivot: this._toBoolean(defaultPivotRaw, false),
                        frame: this._coerceNumber(source.frame, this._coerceNumber(defaults ? defaults.frame : 0, 0))
                };
        }

        _extractTimelineObjectSource(key, objectType)
        {
                if (!key || typeof key !== "object")
                {
                        return null;
                }

                const type = typeof objectType === "string" ? objectType.toLowerCase() : "";

                if (type === "bone")
                {
                        if (Array.isArray(key.bones) && key.bones.length)
                        {
                                return key.bones[0];
                        }

                        if (key.bone)
                        {
                                return key.bone;
                        }
                }

                if (Array.isArray(key.objects) && key.objects.length)
                {
                        return key.objects[0];
                }

                if (key.object)
                {
                        return key.object;
                }

                if (Array.isArray(key.bones) && key.bones.length)
                {
                        return key.bones[0];
                }

                if (key.bone)
                {
                        return key.bone;
                }

                return null;
        }

        _writeObjectState(target, source)
        {
                if (!target || !source)
                {
                        return;
                }

                target.type = source.type;
                target.x = source.x;
                target.y = source.y;
                target.angle = source.angle;
                target.scaleX = source.scaleX;
                target.scaleY = source.scaleY;
                target.alpha = source.alpha;
                target.pivotX = source.pivotX;
                target.pivotY = source.pivotY;
                target.folder = source.folder;
                target.file = source.file;
                target.entity = source.entity;
                target.animation = source.animation;
                target.t = source.t;
                target.defaultPivot = !!source.defaultPivot;
                target.frame = source.frame;
        }

        _writeInterpolatedState(target, fromState, toState, t, spin)
        {
                if (!target || !fromState)
                {
                        return;
                }

                if (!toState)
                {
                        this._writeObjectState(target, fromState);
                        return;
                }

                const ratio = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));

                target.type = fromState.type;
                target.x = this._lerp(fromState.x, toState.x, ratio);
                target.y = this._lerp(fromState.y, toState.y, ratio);
                target.angle = this._lerpAngle(fromState.angle, toState.angle, ratio, spin);
                target.scaleX = this._lerp(fromState.scaleX, toState.scaleX, ratio);
                target.scaleY = this._lerp(fromState.scaleY, toState.scaleY, ratio);
                target.alpha = this._lerp(fromState.alpha, toState.alpha, ratio);
                target.pivotX = fromState.pivotX;
                target.pivotY = fromState.pivotY;
                target.folder = ratio < 1 ? fromState.folder : toState.folder;
                target.file = ratio < 1 ? fromState.file : toState.file;
                target.entity = ratio < 1 ? fromState.entity : toState.entity;
                target.animation = ratio < 1 ? fromState.animation : toState.animation;
                target.t = this._lerp(fromState.t, toState.t, ratio);
                target.defaultPivot = !!(fromState.defaultPivot && toState.defaultPivot);
                target.frame = fromState.frame;
        }

        _normaliseTimeWithinAnimation(time, length, isLooping)
        {
                if (!Number.isFinite(time))
                {
                        return 0;
                }

                if (length <= 0)
                {
                        return 0;
                }

                if (isLooping)
                {
                        const mod = ((time % length) + length) % length;
                        return mod;
                }

                return Math.max(0, Math.min(length, time));
        }

        _wrapAnimationTime(time, length, isLooping)
        {
                if (!Number.isFinite(time))
                {
                        return 0;
                }

                if (length <= 0)
                {
                        return 0;
                }

                if (isLooping)
                {
                        return ((time % length) + length) % length;
                }

                return Math.max(0, Math.min(length, time));
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

        _cubicBezierAtTime(t, x1, y1, x2, y2, duration)
        {
                const ax = 3 * x1 - 3 * x2 + 1;
                const bx = 3 * x2 - 6 * x1;
                const cx = 3 * x1;

                const ay = 3 * y1 - 3 * y2 + 1;
                const by = 3 * y2 - 6 * y1;
                const cy = 3 * y1;

                const epsilon = this._solveEpsilon(duration);
                return this._solve(ax, bx, cx, ay, by, cy, t, epsilon);
        }

        _sampleCurve(ax, bx, cx, t)
        {
                return ((ax * t + bx) * t + cx) * t;
        }

        _sampleCurveDerivativeX(ax, bx, cx, t)
        {
                return (3.0 * ax * t + 2.0 * bx) * t + cx;
        }

        _solveEpsilon(duration)
        {
                return 1.0 / (200.0 * Math.max(0.01, duration));
        }

        _solve(ax, bx, cx, ay, by, cy, x, epsilon)
        {
                return this._sampleCurve(ay, by, cy, this._solveCurveX(ax, bx, cx, x, epsilon));
        }

        _solveCurveX(ax, bx, cx, x, epsilon)
        {
                let t2 = x;
                for (let i = 0; i < 8; i++)
                {
                        const x2 = this._sampleCurve(ax, bx, cx, t2) - x;
                        if (this._fabs(x2) < epsilon)
                        {
                                return t2;
                        }

                        const d2 = this._sampleCurveDerivativeX(ax, bx, cx, t2);
                        if (this._fabs(d2) < 1e-6)
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
                        const x2 = this._sampleCurve(ax, bx, cx, t2);
                        if (this._fabs(x2 - x) < epsilon)
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

        _fabs(n)
        {
                return n >= 0 ? n : -n;
        }

        _lerpAngle(a, b, t, spin)
        {
                if (!Number.isFinite(a))
                {
                        return Number.isFinite(b) ? b : 0;
                }

                if (!Number.isFinite(b))
                {
                        return a;
                }

                if (spin === 0)
                {
                        return a;
                }

                const ratio = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
                const useDegrees = Math.abs(a) > Math.PI * 2 || Math.abs(b) > Math.PI * 2;
                const from = useDegrees ? this._degreesToRadians(a) : a;
                const to = useDegrees ? this._degreesToRadians(b) : b;
                const diff = this._angleDifference(from, to);
                const resultRad = spin === -1 ? from + diff * ratio : from - diff * ratio;

                if (useDegrees)
                {
                        return this._radiansToDegrees(resultRad);
                }

                return resultRad;
        }

        _angleDifference(a, b)
        {
                if (!Number.isFinite(a) || !Number.isFinite(b))
                {
                        return 0;
                }

                const pi = Math.PI;
                const rad = pi * 2;
                let start = a;
                let end = b;

                while (end - start < -pi)
                {
                        start -= rad;
                }

                while (end - start > pi)
                {
                        end -= rad;
                }

                return Math.abs(end - start);
        }

        _degreesToRadians(angleInDegrees)
        {
                return angleInDegrees * 0.0174533;
        }

        _radiansToDegrees(angleInRadians)
        {
                return angleInRadians / 0.0174533;
        }

        _toBoolean(value, fallback = false)
        {
                if (typeof value === "boolean")
                {
                        return value;
                }

                if (typeof value === "number")
                {
                        if (!Number.isFinite(value))
                        {
                                return fallback;
                        }
                        return value !== 0;
                }

                if (typeof value === "string")
                {
                        const trimmed = value.trim();
                        if (!trimmed)
                        {
                                return fallback;
                        }

                        const lower = trimmed.toLowerCase();
                        if (lower === "true")
                        {
                                return true;
                        }

                        if (lower === "false")
                        {
                                return false;
                        }

                        const numeric = Number(trimmed);
                        if (Number.isFinite(numeric))
                        {
                                return numeric !== 0;
                        }
                }

                return fallback;
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
                this.lastKnownTime = this._getNowTime();

                const mainlineState = this._resolveMainlineState(animation, this.currentSpriterTime);
                this.currentAdjustedTime = mainlineState.adjustedTime;

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

                this._updateAnimationFrameState(animation, mainlineState);
                this._updateWorldBoundsFromAnimation(animation);
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
                // TODO: render the Spriter animation once the runtime is implemented.
        }

        _tick()
        {
                const previousKnownTime = this.lastKnownTime;
                const now = this._getNowTime();
                this.lastKnownTime = now;

                const animation = this.currentAnimation;
                if (!animation)
                {
                        this._resetFrameState();
                        return;
                }

                const length = this._getAnimationLength(animation);
                if (length <= 0)
                {
                        this.currentSpriterTime = 0;
                        this.currentAdjustedTime = 0;
                        this._resetFrameState();
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

                const mainlineState = this._resolveMainlineState(animation, this.currentSpriterTime);
                this.currentAdjustedTime = mainlineState.adjustedTime;

                this._updateAnimationFrameState(animation, mainlineState);

                if (animationFinished)
                {
                        this._onAnimationFinished(animation);
                }
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
