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

async function awaitMaybePromise(result)
{
	if (result && typeof result.then === "function")
	{
		return await result;
	}

	return result;
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

function stripFileExtension(fileName)
{
	if (typeof fileName !== "string")
	{
		return "";
	}

	const dot = fileName.lastIndexOf(".");
	return dot > 0 ? fileName.slice(0, dot) : fileName;
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

function findZipEntryByPathOrLeaf(zipFile, rawPath)
{
	if (!zipFile || typeof zipFile.GetEntry !== "function")
	{
		return null;
	}

	const direct = typeof rawPath === "string" ? zipFile.GetEntry(rawPath) : null;
	if (direct)
	{
		return direct;
	}

	const leaf = getPathLeafRaw(rawPath);
	if (leaf && leaf !== rawPath)
	{
		return zipFile.GetEntry(leaf);
	}

	return null;
}

function getFolderFiles(folder)
{
	if (!folder || typeof folder !== "object")
	{
		return [];
	}

	if (Array.isArray(folder.file))
	{
		return folder.file;
	}

	if (Array.isArray(folder.files))
	{
		return folder.files;
	}

	return [];
}

async function loadSoundsFromFolders(folders, zipFile, project)
{
	if (!Array.isArray(folders) || !zipFile || !project)
	{
		return [];
	}

	const sounds = [];
	const seenFileNames = new Set();

	for (const folder of folders)
	{
		const files = getFolderFiles(folder);
		for (const file of files)
		{
			if (!file || typeof file !== "object")
			{
				continue;
			}

			const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
			if (type !== "sound")
			{
				continue;
			}

			const filePath = typeof file.name === "string" ? file.name : "";
			if (!filePath)
			{
				continue;
			}

			const entry = findZipEntryByPathOrLeaf(zipFile, filePath);
			if (!entry)
			{
				console.warn(`[Spriter] Missing sound in zip: '${filePath}'`);
				continue;
			}

			const soundBlob = await zipFile.ReadBlob(entry);
			const fileName = getPathLeafRaw(filePath);
			if (!fileName)
			{
				continue;
			}

			// Legacy behaviour keeps only the leaf name in project audio files.
			try
			{
				await awaitMaybePromise(project.AddOrReplaceProjectFile(soundBlob, fileName, "sound"));
			}
			catch (error)
			{
				console.warn(`[Spriter] Failed to save sound '${fileName}' to Project Files.`, error);
			}

			if (!seenFileNames.has(fileName))
			{
				seenFileNames.add(fileName);
				sounds.push(soundBlob);
			}
		}
	}

	return sounds;
}

async function addSoundEvents(eventSheet, spriterObjectType, project, baseObjectTypeName)
{
	if (!eventSheet || !spriterObjectType || !project)
	{
		return;
	}

	const audioEventBlock = await eventSheet.GetRoot().AddEventBlock();
	audioEventBlock.AddCondition(spriterObjectType, null, "on-sound-triggered");

	let audioObject = project.GetSingleGlobalObjectType("Audio");
	if (!audioObject)
	{
		audioObject = await project.CreateObjectType("Audio", "Audio");
	}

	const exprPrefix = stripFileExtension(String(baseObjectTypeName || spriterObjectType.GetName() || "")).replace(/\s+/g, "");
	const objectExprPrefix = exprPrefix || "Spriter";
	audioEventBlock.AddAction(audioObject, null, "play-by-name", [
		"sounds",
		`${objectExprPrefix}.TriggeredSound`,
		"not-looping",
		0,
		0,
		`"${objectExprPrefix}Sound"`
	]);
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
	await awaitMaybePromise(project.AddOrReplaceProjectFile(pngBlob, targetPath, "general"));
	return true;
}

// ───── Non-self-draw import helpers ─────

function sanitiseTypeName(name)
{
	if (typeof name !== "string")
	{
		return "";
	}

	return name.replace(/-/g, "").replace(/ /g, "");
}

function getObjectTypeNamesFromScon(json, spriterTypeName)
{
	if (!json || !json.scon_version)
	{
		return [];
	}

	const entities = Array.isArray(json.entity) ? json.entity : [];
	const names = [];
	for (const entity of entities)
	{
		const entityName = entity.name || "";
		const objInfos = Array.isArray(entity.obj_info) ? entity.obj_info : [];
		for (const objInfo of objInfos)
		{
			const rawName = objInfo.name || "";
			if (rawName)
			{
				const name = stripEntityPrefix(rawName, entityName);
				names.push(sanitiseTypeName(spriterTypeName + "_" + name));
			}
		}
	}

	return names;
}

function getFirstObjectRefsFromEntity(entity)
{
	const animations = entity && Array.isArray(entity.animation) ? entity.animation : [];
	const firstAnim = animations[0];
	if (!firstAnim)
	{
		return [];
	}

	const mainline = firstAnim.mainline;
	if (!mainline)
	{
		return [];
	}

	const keys = Array.isArray(mainline.key) ? mainline.key : [];
	const firstKey = keys[0];
	if (!firstKey)
	{
		return [];
	}

	return Array.isArray(firstKey.object_ref) ? firstKey.object_ref : [];
}

function getFileFromFolders(folders, folderIndex, fileIndex)
{
	const folder = folders[folderIndex];
	if (!folder)
	{
		return null;
	}

	const files = Array.isArray(folder.file) ? folder.file : [];
	return files[fileIndex] || null;
}

function makeSpriterObject(initialX, initialY, realName)
{
	return {
		x: initialX,
		y: initialY,
		angle: 0,
		realName: realName || "",
		startingFolderIndex: -1,
		startingFileIndex: -1,
		scaleX: 1,
		scaleY: 1,
		pivotX: 0,
		pivotY: 0,
		alpha: 1,
		startingFrame: 0,
		width: 0,
		height: 0
	};
}

function setSpriterObjectToMainlineRef(objRefs, spriterObject)
{
	for (const objRef of objRefs)
	{
		if (objRef.name === spriterObject.realName)
		{
			spriterObject.x += (objRef.abs_x || 0);
			spriterObject.y += (objRef.abs_y || 0);
			spriterObject.angle = -(objRef.abs_angle || 0) * (Math.PI / 180);
			spriterObject.scaleX = objRef.abs_scale_x != null ? objRef.abs_scale_x : 1;
			spriterObject.scaleY = objRef.abs_scale_y != null ? objRef.abs_scale_y : 1;
			spriterObject.pivotX = objRef.abs_pivot_x || 0;
			spriterObject.pivotY = objRef.abs_pivot_y || 0;
			spriterObject.alpha = objRef.abs_a != null ? objRef.abs_a : 1;
			spriterObject.startingFolderIndex = objRef.folder != null ? objRef.folder : -1;
			spriterObject.startingFileIndex = objRef.file != null ? objRef.file : -1;
			break;
		}
	}
}

function applySpriterObjectToInst(inst, spriterObject)
{
	// Apply pivot offset to position
	const x = -1 * spriterObject.pivotX * spriterObject.width;
	const y = -1 * (1 - spriterObject.pivotY) * spriterObject.height;

	let s = 0, c = 1;
	if (spriterObject.angle !== 0)
	{
		s = Math.sin(spriterObject.angle);
		c = Math.cos(spriterObject.angle);
	}

	const xNew = (x * c) - (y * s);
	const yNew = (x * s) + (y * c);

	inst.SetXY(xNew + spriterObject.x, yNew + spriterObject.y);
	inst.SetSize(spriterObject.width, spriterObject.height);
	inst.SetAngle(spriterObject.angle);
	inst.SetOpacity(spriterObject.alpha);
	if (typeof inst.SetPropertyValue === "function")
	{
		inst.SetPropertyValue("initial-frame", spriterObject.startingFrame);
	}
}

function stripEntityPrefix(name, entityName)
{
	if (entityName && name.startsWith(entityName + "_"))
	{
		return name.slice(entityName.length + 1);
	}
	return name;
}

async function importSpriteData(zipFile, opts, objInfo, folders, objRefs, spriterObjectType, c2ObjectTypes, objectTypeNamePairs, entityName)
{
	const layoutView = opts.layoutView;
	const project = layoutView.GetProject();

	const rawName = objInfo.name || "";
	const name = stripEntityPrefix(rawName, entityName);
	const spriterTypeName = spriterObjectType.GetName();
	const childTypeName = sanitiseTypeName(spriterTypeName + "_" + name);

	let reimport = false;
	let childObjectType = project.GetObjectTypeByName(childTypeName);
	if (!childObjectType)
	{
		childObjectType = await project.CreateObjectType("Sprite", childTypeName);
		console.log(`[Spriter] Created sprite type '${childTypeName}'.`);
	}
	else
	{
		reimport = true;
		console.log(`[Spriter] Reimporting sprite type '${childTypeName}'.`);
	}

	objectTypeNamePairs.push({ objectType: childObjectType, name: name });
	console.log(`[Spriter] Associate pair: c3TypeName='${childTypeName}', spriterName='${name}', objInfo.name='${objInfo.name}'`);

	const animations = childObjectType.GetAnimations();
	const firstAnim = animations[0];
	firstAnim.SetSpeed(0);
	firstAnim.SetLooping(false);
	const frames = firstAnim.GetFrames();

	const frameInfos = Array.isArray(objInfo.frames) ? objInfo.frames : [];
	if (!frameInfos.length)
	{
		c2ObjectTypes.push(childObjectType);
		return;
	}

	const sprObj = makeSpriterObject(opts.layoutX, opts.layoutY, objInfo.realname || name);
	setSpriterObjectToMainlineRef(objRefs, sprObj);

	const existingFrames = reimport ? firstAnim.GetFrames() : null;

	for (let i = 0; i < frameInfos.length; i++)
	{
		const frame = frameInfos[i];
		if (!frame)
		{
			break;
		}

		const folderIndex = frame.folder;
		const fileIndex = frame.file;
		const file = getFileFromFolders(folders, folderIndex, fileIndex);
		if (!file)
		{
			break;
		}

		const imagePath = file.name || "";
		const imageEntry = zipFile.GetEntry(imagePath);
		if (!imageEntry)
		{
			console.warn(`[Spriter] Missing image in zip: '${imagePath}'`);
			break;
		}

		const imageBlob = await zipFile.ReadBlob(imageEntry);
		const fileWidth = file.width || 0;
		const fileHeight = file.height || 0;

		if (i > 0)
		{
			let currentFrame = null;
			if (reimport && existingFrames && existingFrames.length > i)
			{
				currentFrame = existingFrames[i];
				await currentFrame.ReplaceBlobAndDecode(imageBlob);
			}
			else
			{
				currentFrame = await firstAnim.AddFrame(imageBlob, fileWidth, fileHeight);
			}

			if (currentFrame)
			{
				currentFrame.SetOriginX(0);
				currentFrame.SetOriginY(0);
			}
		}
		else
		{
			const currentFrame = frames[0];
			currentFrame.SetOriginX(0);
			currentFrame.SetOriginY(0);
			await currentFrame.ReplaceBlobAndDecode(imageBlob);
		}

		if (folderIndex === sprObj.startingFolderIndex && fileIndex === sprObj.startingFileIndex)
		{
			sprObj.startingFrame = i;
		}

		if (sprObj.startingFrame === i)
		{
			sprObj.width = fileWidth * sprObj.scaleX;
			sprObj.height = fileHeight * sprObj.scaleY;
		}
	}

	// On reimport, remove excess frames
	if (reimport)
	{
		const existingNow = firstAnim.GetFrames();
		for (let i = existingNow.length - 1; i >= frameInfos.length; i--)
		{
			existingNow[i].Delete();
		}

		const wis = childObjectType.GetAllInstances();
		for (const wi of wis)
		{
			applySpriterObjectToInst(wi, sprObj);
		}
	}
	else
	{
		const wi = childObjectType.CreateWorldInstance(layoutView.GetActiveLayer());
		applySpriterObjectToInst(wi, sprObj);
	}

	c2ObjectTypes.push(childObjectType);
}

async function addAssociativeAction(eventBlock, pair, spriterObjectType)
{
	const paramObjectType = pair.objectType;
	const paramName = "\"" + pair.name + "\"";
	console.log(`[Spriter] AddAction associate-type-with-name: objectType=${paramObjectType && paramObjectType.GetName ? paramObjectType.GetName() : paramObjectType}, spriterName=${paramName}`);
	await eventBlock.AddAction(spriterObjectType, null, "associate-type-with-name",
		[paramObjectType, paramName]);
}

// ───── End non-self-draw import helpers ─────

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
		const folders = Array.isArray(projectJson.folder) ? projectJson.folder : [];
		const eventSheet = layoutView.GetLayout().GetEventSheet();

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
			await awaitMaybePromise(project.AddOrReplaceProjectFile(saveJsonToBlob(projectJson), sconFileName, "general"));
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
			// Non-atlased import: create individual Sprite object types for each Spriter part.
			await awaitMaybePromise(project.AddOrReplaceProjectFile(sconBlob, sconFileName, "general"));
			console.log(`[Spriter] Non-atlased export. Saved '${sconFileName}' to Project Files.`);

			// Read old SCON for reimport cleanup (track which sprite types existed before).
			let oldObjectNames = null;
			if (isReimport)
			{
				const oldSconFile = await project.GetProjectFileByName(sconFileName);
				if (oldSconFile)
				{
					try
					{
						const oldBlob = oldSconFile.GetBlob();
						if (oldBlob)
						{
							const oldText = await oldBlob.text();
							const oldJson = JSON.parse(oldText);
							oldObjectNames = getObjectTypeNamesFromScon(oldJson, detectedSconName);
						}
					}
					catch (e)
					{
						console.warn(`[Spriter] Could not parse old .scon for reimport cleanup.`, e);
					}
				}
			}

			const entities = Array.isArray(projectJson.entity) ? projectJson.entity : [];

			const c2ObjectTypes = [];
			const objectTypeNamePairs = [];

			// Collect all sprite obj_infos, then sort by object_ref z-order
			// (object_ref list in mainline key 0 is ordered back-to-front).
			const spriteImportQueue = [];

			for (const entity of entities)
			{
				const objRefs = getFirstObjectRefsFromEntity(entity);
				const objInfos = Array.isArray(entity.obj_info) ? entity.obj_info : [];
				const entityName = entity.name || "";

				for (const objInfo of objInfos)
				{
					const objType = objInfo.type || "sprite";
					if (objType === "sprite")
					{
						const strippedName = stripEntityPrefix(objInfo.name || "", entityName);
						const realName = objInfo.realname || strippedName;
						const refIndex = objRefs.findIndex(ref => ref.name === realName);
						spriteImportQueue.push({
							objInfo, folders, objRefs, entityName,
							zOrder: refIndex >= 0 ? refIndex : 999999
						});
					}

					// Track for reimport cleanup: remove this name from old list
					if (oldObjectNames)
					{
						const strippedName = stripEntityPrefix(objInfo.name || "", entityName);
						const typeName = sanitiseTypeName(detectedSconName + "_" + strippedName);
						let idx = oldObjectNames.indexOf(typeName);
						while (idx !== -1)
						{
							oldObjectNames.splice(idx, 1);
							idx = oldObjectNames.indexOf(typeName);
						}
					}
				}
			}

			// Sort by z-order (back-to-front) so earlier-created sprites are behind later ones
			spriteImportQueue.sort((a, b) => a.zOrder - b.zOrder);

			// Create sprites sequentially to preserve z-order
			for (const item of spriteImportQueue)
			{
				await importSpriteData(
					zipFile, opts, item.objInfo, item.folders, item.objRefs,
					objectType, c2ObjectTypes, objectTypeNamePairs,
					item.entityName
				);
			}
			console.log(`[Spriter] Created/updated ${c2ObjectTypes.length} sprite type(s).`);

			// Auto-generate event block: "On ready" + associate actions.
			if (eventSheet && objectTypeNamePairs.length > 0)
			{
				const eventBlock = await eventSheet.GetRoot().AddEventBlock();
				eventBlock.AddCondition(objectType, null, "on-ready");
				for (const pair of objectTypeNamePairs)
				{
					await addAssociativeAction(eventBlock, pair, objectType);
				}
				console.log(`[Spriter] Added event block with ${objectTypeNamePairs.length} associate action(s).`);
			}

			// Reimport cleanup: remove old container and delete obsolete sprite types.
			if (isReimport)
			{
				const oldContainer = objectType.GetContainer ? objectType.GetContainer() : null;
				if (oldContainer)
				{
					try
					{
						const members = oldContainer.GetMembers();
						for (const member of members)
						{
							oldContainer.RemoveObjectType(member);
							if (!oldContainer.IsActive || !oldContainer.IsActive())
							{
								break;
							}
						}
					}
					catch (e)
					{
						console.warn(`[Spriter] Could not clean up old container.`, e);
					}
				}

				// Delete sprite types that no longer exist in the new SCON.
				if (oldObjectNames && oldObjectNames.length > 0)
				{
					for (const oldName of oldObjectNames)
					{
						const oldObj = project.GetObjectTypeByName(oldName);
						if (oldObj)
						{
							oldObj.Delete();
							console.log(`[Spriter] Deleted obsolete sprite type '${oldName}'.`);
						}
					}
				}

				// On reimport, clear old default animation if needed.
				if (c2ObjectTypes.length > 0)
				{
					try
					{
						const newAnim = await objectType.AddAnimation("Animation 1");
						objectType.GetAnimations()[0].Delete();
					}
					catch (e)
					{
						// Ignore - may not be needed.
					}
				}
			}

			// Family: group child sprite types.
			const familyName = detectedSconName + "Family";
			try
			{
				let family = typeof project.GetFamilyByName === "function"
					? project.GetFamilyByName(familyName)
					: null;
				if (family)
				{
					if (c2ObjectTypes.length > 0)
					{
						family.SetMembers(c2ObjectTypes);
					}
					else
					{
						family.Delete();
					}
				}
				else if (c2ObjectTypes.length > 0 && typeof project.CreateFamily === "function")
				{
					project.CreateFamily(familyName, c2ObjectTypes);
				}
			}
			catch (e)
			{
				console.warn(`[Spriter] Family creation skipped or failed.`, e);
			}

			// Container: group Spriter object + all child sprite types.
			const allContainerTypes = [...c2ObjectTypes, objectType];
			if (allContainerTypes.length > 1)
			{
				try
				{
					const container = objectType.CreateContainer(allContainerTypes);
					container.SetSelectMode("wrap");
					console.log(`[Spriter] Created container with ${allContainerTypes.length} member(s).`);
				}
				catch (e)
				{
					console.warn(`[Spriter] Container creation failed.`, e);
				}
			}
		}

		const importedSounds = await loadSoundsFromFolders(folders, zipFile, project);
		if (importedSounds.length > 0)
		{
			console.log(`[Spriter] Imported ${importedSounds.length} sound file(s).`);

			if (eventSheet && !isReimport)
			{
				await addSoundEvents(eventSheet, objectType, project, detectedSconName);
				console.log("[Spriter] Added default sound trigger event block.");
			}
			else if (eventSheet && isReimport)
			{
				console.log("[Spriter] Reimport detected; skipped auto-adding default sound event block.");
			}

			if (typeof project.ShowImportAudioDialog === "function")
			{
				project.ShowImportAudioDialog(importedSounds);
			}
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
