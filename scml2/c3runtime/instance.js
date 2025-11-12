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
