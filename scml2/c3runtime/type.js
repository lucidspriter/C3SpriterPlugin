const C3 = globalThis.C3;

function normaliseProjectFileName(fileName)
{
	if (typeof fileName !== "string")
	{
		return "";
	}

	let normalised = fileName.trim().toLowerCase();

	if (normalised.endsWith(".scml"))
	{
		normalised = normalised.replace(/\.scml$/, ".scon");
	}

	return normalised;
}

function getAssetManager(runtime)
{
	if (!runtime)
	{
		return null;
	}

	if (typeof runtime.GetAssetManager === "function")
	{
		return runtime.GetAssetManager();
	}

	return runtime.assets || null;
}

C3.Plugins.Spriter.Type = class SpriterType extends globalThis.ISDKObjectTypeBase
{
	constructor()
	{
		super();

		// Shared caches for Spriter project data (filled in during Phase 3).
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
		return !!cacheKey && this._projectDataCache.has(cacheKey);
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

	_requestProjectDataLoad(projectFileName)
	{
		const cacheKey = normaliseProjectFileName(projectFileName);
		if (!cacheKey)
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

		const runtime = this.runtime;
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
		const assetManager = getAssetManager(runtime);

		if (!assetManager)
		{
			throw new Error("Spriter: runtime asset manager is unavailable.");
		}

		const getUrl =
			assetManager.GetProjectFileUrl ||
			assetManager.getProjectFileUrl ||
			null;

		if (typeof getUrl !== "function")
		{
			throw new Error("Spriter: asset manager does not support GetProjectFileUrl().");
		}

		const projectUrl = await getUrl.call(assetManager, projectFileName);

		if (typeof projectUrl !== "string" || !projectUrl)
		{
			throw new Error(`Spriter: failed to resolve URL for project file '${projectFileName}'.`);
		}

		const fetchJson =
			assetManager.FetchJson ||
			assetManager.fetchJson ||
			null;

		let projectJson;
		if (typeof fetchJson === "function")
		{
			projectJson = await fetchJson.call(assetManager, projectUrl);
		}
		else
		{
			// Fallback: use fetch() directly if asset manager does not provide JSON helpers.
			// Note: this may fail depending on browser/preview security; it's only a last resort.
			const response = await fetch(projectUrl);
			projectJson = await response.json();
		}

		if (typeof projectJson === "string")
		{
			try
			{
				return JSON.parse(projectJson);
			}
			catch (error)
			{
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`Spriter: project '${projectFileName}' returned invalid JSON: ${message}`);
			}
		}

		if (!projectJson || typeof projectJson !== "object")
		{
			throw new Error(`Spriter: project '${projectFileName}' did not provide JSON data.`);
		}

		return projectJson;
	}
};
