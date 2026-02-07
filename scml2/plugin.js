const SDK = globalThis.SDK;
const lang = globalThis.lang;

// Keep the plugin ID stable: projects reference this ID to identify object types.
const PLUGIN_ID = "Spriter";
const PLUGIN_CATEGORY = "general";

function getBaseName(fileName)
{
	if (typeof fileName !== "string")
	{
		return "";
	}

	const trimmed = fileName.trim();
	const dot = trimmed.lastIndexOf(".");
	return dot > 0 ? trimmed.slice(0, dot) : trimmed;
}

function getFirstAnim(objectType)
{
	if (!objectType || typeof objectType.GetAnimations !== "function")
	{
		return null;
	}

	const animations = objectType.GetAnimations();
	return Array.isArray(animations) && animations.length ? animations[0] : null;
}

function getFirstFrame(objectType)
{
	const firstAnim = getFirstAnim(objectType);
	if (!firstAnim || typeof firstAnim.GetFrames !== "function")
	{
		return null;
	}

	const frames = firstAnim.GetFrames();
	return Array.isArray(frames) && frames.length ? frames[0] : null;
}

function getObjectTypePluginId(objectType)
{
	if (!objectType)
	{
		return "";
	}

	try
	{
		if (typeof objectType.GetPluginId === "function")
			return objectType.GetPluginId() || "";
		if (typeof objectType.GetPluginID === "function")
			return objectType.GetPluginID() || "";
		if (typeof objectType.GetPluginIdentifier === "function")
			return objectType.GetPluginIdentifier() || "";
	}
	catch
	{
		// Ignore.
	}

	try
	{
		const plugin = typeof objectType.GetPlugin === "function" ? objectType.GetPlugin() : null;
		if (!plugin)
			return "";

		if (typeof plugin.GetId === "function")
			return plugin.GetId() || "";
		if (typeof plugin.GetID === "function")
			return plugin.GetID() || "";
	}
	catch
	{
		// Ignore.
	}

	return "";
}

function saveJsonToBlob(json)
{
	const text = JSON.stringify(json, null, 2);
	return new Blob([text], { type: "application/json" });
}

function normalisePathKey(path)
{
	if (typeof path !== "string")
	{
		return "";
	}

	return path.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase();
}

function getPathLeaf(path)
{
	const normalised = normalisePathKey(path);
	const lastSlash = normalised.lastIndexOf("/");
	return lastSlash >= 0 ? normalised.slice(lastSlash + 1) : normalised;
}

function getPathLeafRaw(path)
{
	if (typeof path !== "string")
	{
		return "";
	}

	const normalised = path.replace(/\\/g, "/");
	const lastSlash = normalised.lastIndexOf("/");
	return lastSlash >= 0 ? normalised.slice(lastSlash + 1) : normalised;
}

function atlasNameToPngPath(atlasName)
{
	if (typeof atlasName !== "string")
	{
		return "";
	}

	const normalised = atlasName.trim().replace(/\\/g, "/");
	if (!normalised)
	{
		return "";
	}

	const dot = normalised.lastIndexOf(".");
	return dot > 0 ? `${normalised.slice(0, dot)}.png` : `${normalised}.png`;
}

function findAtlasPngEntry(zipFile, atlasPngPath)
{
	if (!zipFile || typeof zipFile.GetEntry !== "function")
	{
		return null;
	}

	let entry = zipFile.GetEntry(atlasPngPath);
	if (entry)
	{
		return entry;
	}

	const leaf = getPathLeafRaw(atlasPngPath);
	if (leaf && leaf !== atlasPngPath)
	{
		entry = zipFile.GetEntry(leaf);
	}

	return entry || null;
}

function applyAtlasFrameInfoToFile(file, atlasFrame)
{
	if (!file || !atlasFrame)
	{
		return;
	}

	// TexturePacker-style JSON format.
	const frameRect = atlasFrame.frame;
	const sourceSize = atlasFrame.sourceSize;
	const spriteSourceSize = atlasFrame.spriteSourceSize;

	if (!frameRect || !sourceSize || !spriteSourceSize)
	{
		return;
	}

	file.ah = frameRect.h;
	file.aw = frameRect.w;
	file.ax = frameRect.x;
	file.ay = frameRect.y;
	file.arot = atlasFrame.rotated;
	file.height = sourceSize.h;
	file.width = sourceSize.w;
	file.axoff = spriteSourceSize.x;
	file.ayoff = spriteSourceSize.y;
}

function buildAtlasFrameLookups(atlasFramesByName)
{
	const byFullPath = new Map();
	const byLeafName = new Map();

	for (const [rawName, frame] of Object.entries(atlasFramesByName))
	{
		const full = normalisePathKey(rawName);
		if (!full || !frame)
		{
			continue;
		}

		if (!byFullPath.has(full))
		{
			byFullPath.set(full, frame);
		}

		const leaf = getPathLeaf(full);
		if (leaf && !byLeafName.has(leaf))
		{
			byLeafName.set(leaf, frame);
		}
	}

	return { byFullPath, byLeafName };
}

function extractAtlasFrameMap(atlasJson)
{
	const frameMap = {};
	if (!atlasJson || typeof atlasJson !== "object")
	{
		return frameMap;
	}

	const frames = atlasJson.frames;
	if (Array.isArray(frames))
	{
		for (const frameEntry of frames)
		{
			if (!frameEntry || typeof frameEntry !== "object")
			{
				continue;
			}

			const key = typeof frameEntry.filename === "string"
				? frameEntry.filename
				: typeof frameEntry.name === "string"
					? frameEntry.name
					: "";

			if (key)
			{
				frameMap[key] = frameEntry;
			}
		}
	}
	else if (frames && typeof frames === "object")
	{
		Object.assign(frameMap, frames);
	}

	return frameMap;
}

function countFilesWithAtlasData(folders)
{
	if (!Array.isArray(folders))
	{
		return 0;
	}

	let count = 0;
	for (const folder of folders)
	{
		const files = folder && Array.isArray(folder.file) ? folder.file : [];
		for (const file of files)
		{
			if (!file || typeof file !== "object")
			{
				continue;
			}

			if (Number.isFinite(Number(file.aw)) && Number(file.aw) > 0 && Number.isFinite(Number(file.ah)) && Number(file.ah) > 0)
			{
				count++;
			}
		}
	}

	return count;
}

function processAtlases(folders, atlasFramesByName)
{
	if (!Array.isArray(folders) || !atlasFramesByName || typeof atlasFramesByName !== "object")
	{
		return 0;
	}

	const lookups = buildAtlasFrameLookups(atlasFramesByName);
	let updatedCount = 0;

	for (const folder of folders)
	{
		const files = folder && Array.isArray(folder.file) ? folder.file : [];
		for (const file of files)
		{
			const fileName = file && typeof file.name === "string" ? file.name : "";
			const full = normalisePathKey(fileName);
			const leaf = getPathLeaf(fileName);

			const atlasFrame = (full && lookups.byFullPath.get(full))
				|| (leaf && lookups.byLeafName.get(leaf))
				|| null;

			if (atlasFrame)
			{
				applyAtlasFrameInfoToFile(file, atlasFrame);
				updatedCount++;
			}
		}
	}

	return updatedCount;
}

async function loadAtlasPngIntoFrames(objectType, zipFile, atlasPngPath, appendAsNewFrame)
{
	const pngEntry = findAtlasPngEntry(zipFile, atlasPngPath);
	if (!pngEntry)
	{
		throw new Error(`Missing atlas png '${atlasPngPath}' in zip.`);
	}

	const pngBlob = await zipFile.ReadBlob(pngEntry);
	const firstAnim = getFirstAnim(objectType);

	if (!firstAnim)
	{
		throw new Error("Spriter: object type has no animations to receive atlas frames.");
	}

	if (appendAsNewFrame)
	{
		await firstAnim.AddFrame(pngBlob);
		return;
	}

	const firstFrame = getFirstFrame(objectType);
	if (!firstFrame || typeof firstFrame.ReplaceBlobAndDecode !== "function")
	{
		throw new Error("Spriter: failed to replace initial frame for atlas png.");
	}

	await firstFrame.ReplaceBlobAndDecode(pngBlob);
}

async function addAtlasPngToProjectFiles(project, zipFile, atlasPngPath)
{
	if (!project || typeof project.AddOrReplaceProjectFile !== "function")
	{
		return false;
	}

	const pngEntry = findAtlasPngEntry(zipFile, atlasPngPath);
	if (!pngEntry)
	{
		console.warn(`[Spriter] Could not add atlas PNG to Project Files (missing in zip): '${atlasPngPath}'.`);
		return false;
	}

	const pngBlob = await zipFile.ReadBlob(pngEntry);
	const targetPath = atlasPngPath || getPathLeaf(atlasPngPath);
	if (!targetPath)
	{
		return false;
	}

	// Use "general" for compatibility with current SDK folder kinds.
	project.AddOrReplaceProjectFile(pngBlob, targetPath, "general");
	return true;
}

async function importSpriterZip(droppedFileName, zipFile, opts)
{
	try
	{
		console.log(`[Spriter] Drop received: '${droppedFileName}'`);

		const baseName = getBaseName(droppedFileName);
		if (!baseName)
		{
			return false;
		}

		if (!zipFile || typeof zipFile.GetEntry !== "function")
		{
			return false;
		}

		// Find the .scon in the zip. Legacy workflow expects "<dropped name>.scon", but many exporters
		// include folders or different zip names - so fall back to scanning for exactly one .scon.
		let sconPathInZip = null;
		const fileList = typeof zipFile.GetFileList === "function" ? zipFile.GetFileList() : null;
		if (Array.isArray(fileList))
		{
			const sconPaths = fileList.filter((p) => typeof p === "string" && p.toLowerCase().endsWith(".scon"));
			if (sconPaths.length === 1)
			{
				sconPathInZip = sconPaths[0];
			}
			else if (sconPaths.length > 1)
			{
				console.error(`[Spriter] Zip contains multiple .scon files; can't choose automatically:`, sconPaths);
				return true;
			}
		}

		const getLastPathComponent = (path) =>
		{
			if (typeof path !== "string")
				return "";
			const normalised = path.replace(/\\/g, "/");
			const lastSlash = normalised.lastIndexOf("/");
			return lastSlash >= 0 ? normalised.slice(lastSlash + 1) : normalised;
		};

		const detectedSconName = sconPathInZip ? getBaseName(getLastPathComponent(sconPathInZip)) : baseName;
		const sconFileName = `${detectedSconName}.scon`;

		const preferredSconPath = `${baseName}.scon`;
		const entryPath = sconPathInZip || preferredSconPath;
		let sconEntry = zipFile.GetEntry(entryPath);

		if (!sconEntry && typeof zipFile.GetFirstEntryWithExtension === "function")
		{
			sconEntry = zipFile.GetFirstEntryWithExtension("scon");
		}

		if (!sconEntry)
		{
			console.warn(`[Spriter] Drop not recognised: no .scon found in zip (expected '${preferredSconPath}').`);
			return false;
		}

		const layoutView = opts && opts.layoutView ? opts.layoutView : null;
		if (!layoutView || typeof layoutView.GetProject !== "function")
		{
			throw new Error("Spriter: drag-drop import requires layoutView (toLayoutView: true).");
		}

		const project = layoutView.GetProject();

		const sconBlob = await zipFile.ReadBlob(sconEntry);
		const projectJson = await zipFile.ReadJson(sconEntry);

		if (!projectJson || typeof projectJson !== "object" || !projectJson.scon_version)
		{
			return false;
		}

		const entityCount = Array.isArray(projectJson.entity) ? projectJson.entity.length : 0;
		const atlasCount = Array.isArray(projectJson.atlas) ? projectJson.atlas.length : 0;
		console.log(`[Spriter] Parsed '${sconFileName}': entities=${entityCount}, atlases=${atlasCount}`);

		let objectType = project.GetObjectTypeByName(detectedSconName);
		const isReimport = !!objectType;

		if (!objectType)
		{
			objectType = await project.CreateObjectType("Spriter", detectedSconName);
			console.log(`[Spriter] Created object type '${detectedSconName}'.`);
		}
		else
		{
			console.log(`[Spriter] Reimporting into existing object type '${detectedSconName}'.`);
		}

		const pluginId = getObjectTypePluginId(objectType);
		if (pluginId)
		{
			console.log(`[Spriter] Object type plugin id: '${pluginId}'.`);
		}

		const atlases = Array.isArray(projectJson.atlas) ? projectJson.atlas : null;
		const isAtlased = !!(atlases && atlases.length);

			if (isAtlased)
			{
				console.log(`[Spriter] Atlased export detected. Loading atlas PNGs into frames...`);
				// Reset any existing atlas frames on the first animation (keep frame 0, replace it).
				const firstAnim = getFirstAnim(objectType);
				if (firstAnim)
				{
					const frames = firstAnim.GetFrames();
					for (let i = frames.length - 1; i >= 1; i--)
					{
						frames[i].Delete();
					}
				}

				// Load atlas PNGs into the Spriter object's own frames. Atlas index == frame index.
				for (let i = 0; i < atlases.length; i++)
				{
					const atlas = atlases[i];
					const atlasName = atlas && typeof atlas.name === "string" ? atlas.name : "";
					const atlasPngPath = atlasNameToPngPath(atlasName);
					const atlasPngLeaf = getPathLeafRaw(atlasPngPath);

					if (!atlasPngPath)
					{
						continue;
					}

					console.log(`[Spriter] Loading atlas ${i}: '${atlasPngLeaf || atlasPngPath}'`);
					await loadAtlasPngIntoFrames(objectType, zipFile, atlasPngPath, i > 0);

					const added = await addAtlasPngToProjectFiles(project, zipFile, atlasPngPath);
					if (added)
					{
						console.log(`[Spriter] Added atlas image to Project Files: '${atlasPngPath}'.`);
					}
				}

			const atlasFramesByName = {};
			let atlasJsonLoadedCount = 0;

			// Try to read atlas metadata from every listed atlas entry.
			// Some exports include full metadata in .scon, others in external atlas JSON.
			for (let i = 0; i < atlases.length; i++)
			{
				const atlas = atlases[i];
				const atlasMetaName = atlas && typeof atlas.name === "string" ? atlas.name : "";
				if (!atlasMetaName)
				{
					continue;
				}

				const atlasMetaEntry = zipFile.GetEntry(atlasMetaName);
				if (!atlasMetaEntry)
				{
					continue;
				}

				try
				{
					const atlasJson = await zipFile.ReadJson(atlasMetaEntry);
					const frameMap = extractAtlasFrameMap(atlasJson);
					const frameCount = Object.keys(frameMap).length;
					if (frameCount > 0)
					{
						Object.assign(atlasFramesByName, frameMap);
						atlasJsonLoadedCount++;
					}
				}
				catch (error)
				{
					console.warn(`[Spriter] Atlas metadata '${atlasMetaName}' is not JSON (or failed to parse).`, error);
				}
			}

			const atlasDataBefore = countFilesWithAtlasData(projectJson.folder);
			const updatedCount = processAtlases(projectJson.folder, atlasFramesByName);
			const atlasDataAfter = countFilesWithAtlasData(projectJson.folder);

			if (atlasJsonLoadedCount > 0)
			{
				console.log(`[Spriter] Applied atlas metadata from ${atlasJsonLoadedCount} atlas JSON file(s) to ${updatedCount} file entry(ies).`);
			}

			if (atlasDataAfter <= 0)
			{
				console.warn("[Spriter] No atlas rectangle metadata (aw/ah/ax/ay) found in final .scon; runtime will render fallback debug quads.");
			}
			else if (atlasDataBefore <= 0 && atlasDataAfter > 0)
			{
				console.log(`[Spriter] Atlas metadata is now present in ${atlasDataAfter} file entry(ies).`);
			}

			// Always save the normalized JSON for atlased exports so runtime has consistent metadata.
			project.AddOrReplaceProjectFile(saveJsonToBlob(projectJson), sconFileName, "general");
			if (updatedCount > 0)
			{
				console.log(`[Spriter] Saved merged '${sconFileName}' to Project Files.`);
			}
			else
			{
				console.log(`[Spriter] Saved normalized '${sconFileName}' to Project Files.`);
			}
		}
		else
		{
			// Non-atlased import: for now only add the .scon. Non-self-draw sprite creation is Phase 6.
			project.AddOrReplaceProjectFile(sconBlob, sconFileName, "general");
			console.log(`[Spriter] Non-atlased export. Saved '${sconFileName}' to Project Files.`);
		}

		// Apply instance properties.
		const scmlFileValue = sconFileName;
		const drawSelfValue = isAtlased ? "true" : "false";
		const drawDebugValue = "false";

		if (isReimport)
		{
			const instances = objectType.GetAllInstances();
			console.log(`[Spriter] Found ${instances.length} existing instance(s).`);

			for (const inst of instances)
			{
				inst.SetPropertyValue("scml-file", scmlFileValue);
				inst.SetPropertyValue("draw-self", drawSelfValue);
				inst.SetPropertyValue("draw-debug", drawDebugValue);
			}

			// Match legacy behaviour: if the type exists but has no instances, still create one on drop.
			if (!instances.length)
			{
				console.log(`[Spriter] No instances existed; creating one at drop location.`);
				const wi = objectType.CreateWorldInstance(layoutView.GetActiveLayer());
				wi.SetXY(opts.layoutX, opts.layoutY);
				wi.SetPropertyValue("scml-file", scmlFileValue);
				wi.SetPropertyValue("draw-self", drawSelfValue);
				wi.SetPropertyValue("draw-debug", drawDebugValue);
			}
		}
		else
		{
			const wi = objectType.CreateWorldInstance(layoutView.GetActiveLayer());
			wi.SetXY(opts.layoutX, opts.layoutY);
			wi.SetPropertyValue("scml-file", scmlFileValue);
			wi.SetPropertyValue("draw-self", drawSelfValue);
			wi.SetPropertyValue("draw-debug", drawDebugValue);
			console.log(`[Spriter] Created new instance at (${opts.layoutX}, ${opts.layoutY}). scml-file='${scmlFileValue}', draw-self='${drawSelfValue}'.`);
		}

		return true;
	}
	catch (error)
	{
		console.error(`[Spriter] Drag-drop import failed for '${droppedFileName}'.`, error);
		return true; // we recognised it as a Spriter drop; don't pass to other handlers
	}
}

const PLUGIN_CLASS = SDK.Plugins.Spriter = class Spriter extends SDK.IPluginBase
{
	constructor()
	{
		super(PLUGIN_ID);

		SDK.Lang.PushContext("plugins." + PLUGIN_ID.toLowerCase());

		this._info.SetName(lang(".name"));
		this._info.SetDescription(lang(".description"));
		this._info.SetCategory(PLUGIN_CATEGORY);
		this._info.SetAuthor("BrashMonkey");
		this._info.SetHelpUrl(lang(".help-url"));
		this._info.SetPluginType("world");
		this._info.SetIsResizable(true);
		this._info.SetIsRotatable(true);
		this._info.SetHasAnimations(true);
		this._info.SetIsTiled(false);
		this._info.SetIsSingleGlobal(false);
		this._info.SetSupportsEffects(true);
		this._info.SetMustPreDraw(true);
		this._info.SetCanBeBundled(false);
		this._info.SetRuntimeModuleMainScript("c3runtime/main.js");

		this._info.AddCommonPositionACEs();
		this._info.AddCommonAngleACEs();
		this._info.AddCommonAppearanceACEs();
		this._info.AddCommonZOrderACEs();
		this._info.AddCommonSceneGraphACEs();

		SDK.Lang.PushContext(".properties");

		// Keep these property IDs and ordering aligned with the legacy addon.
		this._info.SetProperties([
			new SDK.PluginProperty("text", "scml-file", ""),
			new SDK.PluginProperty("text", "starting-entity", ""),
			new SDK.PluginProperty("text", "starting-animation", ""),
			new SDK.PluginProperty("float", "starting-opacity", 100),
			new SDK.PluginProperty("combo", "draw-self", {
				initialValue: "false",
				items: ["false", "true"]
			}),
			new SDK.PluginProperty("text", "nickname-in-c2", ""),
			new SDK.PluginProperty("combo", "blend-mode", {
				initialValue: "use effects blend mode",
				items: ["no premultiplied alpha blend", "use effects blend mode"]
			}),
			new SDK.PluginProperty("combo", "draw-debug", {
				initialValue: "false",
				items: ["false", "true"]
			})
		]);

		SDK.Lang.PopContext(); // .properties

		SDK.Lang.PopContext();

		// Drag-drop import handler (legacy workflow): dropping a Spriter-exported zip creates/updates
		// a Spriter object type, adds the .scon to Project Files, and (for atlased exports) loads
		// atlas PNGs into the object's own frames for self-draw mode.
		const util = SDK && SDK.UI && SDK.UI.Util ? SDK.UI.Util : null;
		let addDragDropHandler = null;
		let dragDropApiName = "none";

		if (util && typeof util.AddDragDropFileHandler === "function")
		{
			addDragDropHandler = util.AddDragDropFileHandler;
			dragDropApiName = "AddDragDropFileHandler";
		}
		else if (util && typeof util.AddDragDropFileImportHandler === "function")
		{
			addDragDropHandler = util.AddDragDropFileImportHandler;
			dragDropApiName = "AddDragDropFileImportHandler";
		}

		if (!globalThis.__spriterEditorInitLogged)
		{
			globalThis.__spriterEditorInitLogged = true;
			console.log(`[Spriter] Editor plugin initialised. Drag-drop API: ${dragDropApiName}`);
		}

		if (typeof addDragDropHandler === "function")
		{
			addDragDropHandler.call(util, importSpriterZip, {
				isZipFormat: true,
				toLayoutView: true
			});
		}
	}
};

PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
