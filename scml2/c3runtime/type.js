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

		// Shared caches for Spriter image textures (Phase 4+).
		// Keyed by project file path string (e.g. "images/arm.png").
		this._textureCache = new Map();

		// Cache atlas frames (the Spriter object type's own animation frames).
		this._atlasFrameCache = new Map();

		// Track async atlas texture loads (imageInfo.LoadStaticTexture()) so we only request once.
		this._atlasTextureLoadState = new Map();

		this._atlasLookupDebug = {
			loggedSource: false,
			loggedFailure: false
		};
	}
	
	_onCreate()
	{
		// Clear caches if the type is recreated.
		if (this._atlasFrameCache)
			this._atlasFrameCache.clear();
		if (this._atlasTextureLoadState)
			this._atlasTextureLoadState.clear();
	}

	_getObjectClass()
	{
		const directGetObjectClass = typeof this.GetObjectClass === "function"
			? this.GetObjectClass.bind(this)
			: typeof this.getObjectClass === "function"
				? this.getObjectClass.bind(this)
				: null;

		if (directGetObjectClass)
		{
			const objectClass = directGetObjectClass();
			if (objectClass)
			{
				return objectClass;
			}
		}

		if (this._objectClass)
		{
			return this._objectClass;
		}

		const candidates = [this._objectType, this._iObjectType, this._inst, this.inst, this.objectType];
		for (const candidate of candidates)
		{
			if (!candidate)
			{
				continue;
			}

			const getObjectClass = typeof candidate.GetObjectClass === "function"
				? candidate.GetObjectClass.bind(candidate)
				: typeof candidate.getObjectClass === "function"
					? candidate.getObjectClass.bind(candidate)
					: null;

			if (getObjectClass)
			{
				const objectClass = getObjectClass();
				if (objectClass)
				{
					return objectClass;
				}
			}

			if (candidate._objectClass)
			{
				return candidate._objectClass;
			}

			if (typeof candidate.GetAnimations === "function" || typeof candidate.getAnimations === "function")
			{
				return candidate;
			}
		}

		return null;
	}

	_tryGetFramesFromSource(source, visited)
	{
		if (!source || visited.has(source))
		{
			return null;
		}

		visited.add(source);

		const getAnimations = typeof source.GetAnimations === "function"
			? source.GetAnimations.bind(source)
			: typeof source.getAnimations === "function"
				? source.getAnimations.bind(source)
				: null;

		if (getAnimations)
		{
			const animations = getAnimations();
			if (Array.isArray(animations) && animations.length)
			{
				const firstAnimation = animations[0];
				const getFrames = firstAnimation && typeof firstAnimation.GetFrames === "function"
					? firstAnimation.GetFrames.bind(firstAnimation)
					: firstAnimation && typeof firstAnimation.getFrames === "function"
						? firstAnimation.getFrames.bind(firstAnimation)
						: null;

				if (getFrames)
				{
					const frames = getFrames();
					if (Array.isArray(frames))
					{
						return frames;
					}
				}
			}
		}

		const getObjectClass = typeof source.GetObjectClass === "function"
			? source.GetObjectClass.bind(source)
			: typeof source.getObjectClass === "function"
				? source.getObjectClass.bind(source)
				: null;

		if (getObjectClass)
		{
			const objectClass = getObjectClass();
			const frames = this._tryGetFramesFromSource(objectClass, visited);
			if (frames)
			{
				return frames;
			}
		}

		const nestedCandidates = [source._objectClass, source._objectType, source._iObjectType, source._inst, source.inst];
		for (const nested of nestedCandidates)
		{
			const frames = this._tryGetFramesFromSource(nested, visited);
			if (frames)
			{
				return frames;
			}
		}

		return null;
	}

	_getAtlasFrames()
	{
		const visited = new Set();
		const candidates = [
			this._getObjectClass(),
			this,
			this._objectClass,
			this._objectType,
			this._iObjectType,
			this._inst,
			this.inst,
			this.objectType
		];

		for (const candidate of candidates)
		{
			const frames = this._tryGetFramesFromSource(candidate, visited);
			if (Array.isArray(frames))
			{
				if (this._atlasLookupDebug && !this._atlasLookupDebug.loggedSource)
				{
					this._atlasLookupDebug.loggedSource = true;
					console.log(`[Spriter] Atlas frame source resolved (frames=${frames.length}).`);
				}
				return frames;
			}
		}

		if (this._atlasLookupDebug && !this._atlasLookupDebug.loggedFailure)
		{
			this._atlasLookupDebug.loggedFailure = true;
			console.warn("[Spriter] Atlas frame source lookup failed on runtime type.");
		}

		return null;
	}

	_getAtlasFrame(atlasIndex)
	{
		if (!Number.isInteger(atlasIndex) || atlasIndex < 0)
		{
			return null;
		}

		if (this._atlasFrameCache && this._atlasFrameCache.has(atlasIndex))
		{
			return this._atlasFrameCache.get(atlasIndex);
		}

		const frames = this._getAtlasFrames();
		if (!Array.isArray(frames) || atlasIndex >= frames.length)
		{
			return null;
		}

		const frame = frames[atlasIndex] || null;
		if (frame && this._atlasFrameCache)
		{
			this._atlasFrameCache.set(atlasIndex, frame);
		}

		return frame;
	}

	_getAtlasTextureLoadEntry(atlasIndex)
	{
		if (!Number.isInteger(atlasIndex) || atlasIndex < 0)
		{
			return null;
		}

		if (!this._atlasTextureLoadState.has(atlasIndex))
		{
			this._atlasTextureLoadState.set(atlasIndex, { promise: null, error: null });
		}

		return this._atlasTextureLoadState.get(atlasIndex);
	}

	_requestAtlasTextureLoad(atlasIndex, renderer)
	{
		const entry = this._getAtlasTextureLoadEntry(atlasIndex);
		if (!entry || entry.promise || entry.error)
		{
			return;
		}

		const frame = this._getAtlasFrame(atlasIndex);
		if (!frame)
		{
			entry.error = "Missing atlas frame";
			return;
		}

		const imageInfo = frame && typeof frame.GetImageInfo === "function"
			? frame.GetImageInfo()
			: frame && typeof frame.getImageInfo === "function"
				? frame.getImageInfo()
				: frame && frame._imageInfo
					? frame._imageInfo
					: null;

		if (!imageInfo)
		{
			entry.error = "Missing imageInfo";
			return;
		}

		// Already has a texture (or will be handled by the engine).
		const getTexture = imageInfo.GetTexture || imageInfo.getTexture || null;
		if (typeof getTexture === "function" && getTexture.call(imageInfo))
		{
			return;
		}

		const loadStaticTexture = imageInfo.LoadStaticTexture || imageInfo.loadStaticTexture || null;
		if (typeof loadStaticTexture !== "function")
		{
			// Some runtimes handle atlas textures automatically; don't treat as an error.
			return;
		}

		let options = undefined;
		const runtime = this.runtime;
		const sampling = runtime && typeof runtime.GetSampling === "function" ? runtime.GetSampling() : null;
		if (sampling != null)
		{
			options = { sampling };
		}

		try
		{
			const maybePromise = loadStaticTexture.call(imageInfo, renderer, options);
			if (maybePromise && typeof maybePromise.then === "function")
			{
				entry.promise = maybePromise
					.catch((error) =>
					{
						const message = error instanceof Error ? error.message : String(error);
						entry.error = message || "Unknown error";
						console.error(`[Spriter] Failed to load atlas texture ${atlasIndex}: ${entry.error}`, error);
					})
					.finally(() =>
					{
						entry.promise = null;
					});
			}
		}
		catch (error)
		{
			const message = error instanceof Error ? error.message : String(error);
			entry.error = message || "Unknown error";
			console.error(`[Spriter] Failed to request atlas texture ${atlasIndex}: ${entry.error}`, error);
		}
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

	_getTextureEntry(projectFileName)
	{
		if (typeof projectFileName !== "string")
		{
			return null;
		}

		const key = projectFileName.trim();
		if (!key)
		{
			return null;
		}

		if (!this._textureCache.has(key))
		{
			this._textureCache.set(key, {
				texture: null,
				width: null,
				height: null,
				promise: null,
				error: null
			});
		}

		return this._textureCache.get(key);
	}

	_hasTextureErrorForPath(projectFileName)
	{
		const entry = this._getTextureEntry(projectFileName);
		return !!(entry && entry.error);
	}

	_getTextureSizeForPath(projectFileName)
	{
		const entry = this._getTextureEntry(projectFileName);
		if (!entry)
		{
			return null;
		}

		const width = Number(entry.width);
		const height = Number(entry.height);
		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
		{
			return null;
		}

		return { width, height };
	}

	_getOrLoadTextureForPath(projectFileName, renderer)
	{
		const entry = this._getTextureEntry(projectFileName);
		if (!entry)
		{
			return null;
		}

		if (entry.texture)
		{
			return entry.texture;
		}

		if (entry.error || entry.promise)
		{
			return null;
		}

		entry.promise = this._loadTextureFromProjectFile(projectFileName, renderer)
			.then((loaded) =>
			{
				entry.texture = loaded ? loaded.texture : null;
				entry.width = loaded ? loaded.width : null;
				entry.height = loaded ? loaded.height : null;
				entry.error = null;
				return entry.texture;
			})
			.catch((error) =>
			{
				const message = error instanceof Error ? error.message : String(error);
				entry.error = message || "Unknown error";
				entry.texture = null;
				entry.width = null;
				entry.height = null;

				// Only log once per texture path (stored in entry.error).
				console.error(`[Spriter] Failed to load image '${projectFileName}': ${entry.error}`, error);
				return null;
			})
			.finally(() =>
			{
				entry.promise = null;
			});

		return null;
	}

	_releaseAllTextures()
	{
		// Textures created with IRenderer.createStaticTexture() do not have an explicit
		// release method; dropping references allows the engine to GC/handle context loss.
		this._textureCache.clear();

		if (this._atlasTextureLoadState)
		{
			this._atlasTextureLoadState.clear();
		}
	}

	async _loadTextureFromProjectFile(projectFileName, renderer)
	{
		if (!renderer)
		{
			throw new Error("Spriter: renderer is unavailable for texture loading.");
		}

		const createStaticTexture =
			renderer.createStaticTexture ||
			renderer.CreateStaticTexture ||
			null;

		if (typeof createStaticTexture !== "function")
		{
			throw new Error("Spriter: renderer does not support createStaticTexture().");
		}

		const runtime = this.runtime;
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
			throw new Error("Spriter: asset manager does not support getProjectFileUrl().");
		}

		const resolvedUrl = await getUrl.call(assetManager, projectFileName);

		if (typeof resolvedUrl !== "string" || !resolvedUrl)
		{
			throw new Error(`Spriter: failed to resolve URL for image file '${projectFileName}'.`);
		}

		const fetchBlob =
			assetManager.FetchBlob ||
			assetManager.fetchBlob ||
			null;

		let blob;
		if (typeof fetchBlob === "function")
		{
			blob = await fetchBlob.call(assetManager, resolvedUrl);
		}
		else
		{
			const response = await fetch(resolvedUrl);
			blob = await response.blob();
		}

		if (!blob)
		{
			throw new Error(`Spriter: failed to fetch image file '${projectFileName}'.`);
		}

		if (typeof createImageBitmap !== "function")
		{
			throw new Error("Spriter: createImageBitmap() is unavailable; cannot decode images in this environment.");
		}

		const imageBitmap = await createImageBitmap(blob);

		try
		{
			// Temporary test path: force nearest sampling to evaluate atlas edge artifacts.
			// Keep clamp wrapping so atlas UVs never wrap across the whole texture.
			const textureOptions = {
				wrapX: "clamp-to-edge",
				wrapY: "clamp-to-edge",
				sampling: "nearest",
				mipMap: false
			};

			const texture = await createStaticTexture.call(renderer, imageBitmap, textureOptions);
			const width = Number(imageBitmap && imageBitmap.width);
			const height = Number(imageBitmap && imageBitmap.height);

			// Ensure the runtime refreshes even if the animation is paused.
			const sdkUtils = runtime && runtime.sdk;
			if (sdkUtils && typeof sdkUtils.updateRender === "function")
			{
				sdkUtils.updateRender();
			}

			return {
				texture,
				width: Number.isFinite(width) ? width : 0,
				height: Number.isFinite(height) ? height : 0
			};
		}
		finally
		{
			if (imageBitmap && typeof imageBitmap.close === "function")
			{
				imageBitmap.close();
			}
		}
	}
};
