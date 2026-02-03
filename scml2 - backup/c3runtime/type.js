import { normaliseProjectFileName } from "./project-utils.js";

const C3 = globalThis.C3;

C3.Plugins.Spriter.Type = class SpriterType extends globalThis.ISDKObjectTypeBase
{
        constructor()
        {
                super();

                this._projectDataCache = new Map();
                this._projectLoadPromises = new Map();
        }

        _onCreate()
        {
                // TODO: initialise shared resources for Spriter instances.
        }

        _hasProjectData(projectFileName)
        {
                const cacheKey = normaliseProjectFileName(projectFileName);
                return cacheKey ? this._projectDataCache.has(cacheKey) : false;
        }

        _getCachedProjectData(projectFileName)
        {
                const cacheKey = normaliseProjectFileName(projectFileName);
                if (!cacheKey)
                {
                        return null;
                }

                return this._projectDataCache.get(cacheKey) || null;
        }

        _requestProjectDataLoad(projectFileName, runtime)
        {
                const cacheKey = normaliseProjectFileName(projectFileName);

                if (!cacheKey || !runtime)
                {
                        return null;
                }

                if (this._projectDataCache.has(cacheKey))
                {
                        return Promise.resolve(this._projectDataCache.get(cacheKey));
                }

                if (this._projectLoadPromises.has(cacheKey))
                {
                        return this._projectLoadPromises.get(cacheKey);
                }

                const loadPromise = this._fetchProjectData(runtime, cacheKey)
                        .then((projectData) =>
                        {
                                this._projectDataCache.set(cacheKey, projectData);
                                return projectData;
                        })
                        .finally(() =>
                        {
                                this._projectLoadPromises.delete(cacheKey);
                        });

                this._projectLoadPromises.set(cacheKey, loadPromise);
                return loadPromise;
        }

        async _fetchProjectData(runtime, projectFileName)
        {
                const assetManager = (runtime && typeof runtime.GetAssetManager === "function") ? runtime.GetAssetManager() : null;

                if (!assetManager)
                {
                        throw new Error("The Construct runtime asset manager is unavailable.");
                }

                if (typeof assetManager.GetProjectFileUrl !== "function" || typeof assetManager.FetchJson !== "function")
                {
                        throw new Error("The Construct runtime asset manager does not support Spriter project loading.");
                }

                const projectUrl = await assetManager.GetProjectFileUrl(projectFileName);
                const projectJson = await assetManager.FetchJson(projectUrl);

                if (typeof projectJson === "string")
                {
                        try
                        {
                                return JSON.parse(projectJson);
                        }
                        catch (error)
                        {
                                throw new Error(`Spriter project '${projectFileName}' returned invalid JSON: ${error instanceof Error ? error.message : error}`);
                        }
                }

                if (!projectJson || typeof projectJson !== "object")
                {
                        throw new Error(`Spriter project '${projectFileName}' did not provide JSON data.`);
                }

                return projectJson;
        }
};
