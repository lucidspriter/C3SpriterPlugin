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

                this.entity = 0;
                this.entities = [];

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

                this.currentAnimation = "";
                this.secondAnimation = "";
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
                                this.entities = projectData.entity;
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
                this.tagDefs = [];
        }

        _logCleanupWarning(resourceType, error)
        {
                if (typeof console !== "undefined" && console && typeof console.warn === "function")
                {
                        console.warn(`[Spriter] Failed to clean up ${resourceType}:`, error);
                }
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
                // TODO: advance animation state each frame.
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
