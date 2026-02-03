
import type { SDKInstanceClass } from "./instance.ts";

function normaliseProjectFileName(fileName: unknown): string
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

const C3 = globalThis.C3;

function getAssetManager(runtime: unknown): any
{
	if (!runtime)
	{
		return null;
	}

	const candidate = runtime as any;

	if (typeof candidate.GetAssetManager === "function")
	{
		return candidate.GetAssetManager();
	}

	return candidate.assets || null;
}

C3.Plugins.Spriter.Type = class SpriterType extends globalThis.ISDKObjectTypeBase<SDKInstanceClass>
{
	_projectDataCache: Map<string, unknown>;
	_projectLoadPromises: Map<string, Promise<unknown>>;

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

	_hasProjectData(projectFileName: unknown): boolean
	{
		const cacheKey = normaliseProjectFileName(projectFileName);
		return !!cacheKey && this._projectDataCache.has(cacheKey);
	}

	_getCachedProjectData(projectFileName: unknown): unknown | null
	{
		const cacheKey = normaliseProjectFileName(projectFileName);
		if (!cacheKey)
		{
			return null;
		}

		return this._projectDataCache.get(cacheKey) || null;
	}

	_requestProjectDataLoad(projectFileName: unknown): Promise<unknown> | null
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
			return this._projectLoadPromises.get(cacheKey) ?? null;
		}

		const runtime = (this as any).runtime;
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

	async _fetchProjectData(runtime: unknown, projectFileName: string): Promise<unknown>
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

		let projectJson: unknown;
		if (typeof fetchJson === "function")
		{
			projectJson = await fetchJson.call(assetManager, projectUrl);
		}
		else
		{
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
