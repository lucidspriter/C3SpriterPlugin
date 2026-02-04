const C3 = globalThis.C3;

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

function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T>
{
	return !!(value && typeof (value as PromiseLike<T>).then === "function");
}

function clamp(value: number, min: number, max: number): number
{
	return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number
{
	return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number): number
{
	return a + (b - a) * t;
}

function toFiniteNumber(value: unknown, defaultValue: number): number
{
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function spinAngleDegrees(startDegrees: unknown, endDegrees: unknown, spin: unknown): number | { start: number; end: number }
{
	let a0 = toFiniteNumber(startDegrees, 0);
	let a1 = toFiniteNumber(endDegrees, a0);

	const direction = toFiniteNumber(spin, 1);
	if (direction === 0)
	{
		return a0;
	}

	if (direction > 0)
	{
		if (a1 < a0)
		{
			a1 += 360;
		}
	}
	else if (direction < 0)
	{
		if (a1 > a0)
		{
			a1 -= 360;
		}
	}

	return { start: a0, end: a1 };
}

function degreesToRadians(degrees: number): number
{
	return degrees * (Math.PI / 180);
}

function combineTransforms(parent: any, child: any)
{
	const angle = parent.angle + child.angle;
	const cos = Math.cos(parent.angle);
	const sin = Math.sin(parent.angle);

	const x = parent.x + (child.x * parent.scaleX * cos - child.y * parent.scaleY * sin);
	const y = parent.y + (child.x * parent.scaleX * sin + child.y * parent.scaleY * cos);

	return {
		x,
		y,
		angle,
		scaleX: parent.scaleX * child.scaleX,
		scaleY: parent.scaleY * child.scaleY,
		alpha: parent.alpha * child.alpha
	};
}

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

function toStringOrEmpty(value: unknown): string
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

function toNumberOrDefault(value: unknown, defaultValue: number): number
{
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function normaliseComboValue(value: unknown, options: readonly string[], defaultIndex = 0): number
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

function normaliseInitialProperties(initialProperties: readonly JSONValue[]): JSONValue[]
{
	const source = Array.isArray(initialProperties) ? initialProperties : [];
	const normalised = [...source];

	normalised[PROPERTY_INDEX.SCML_FILE] = normaliseProjectFileName(toStringOrEmpty(source[PROPERTY_INDEX.SCML_FILE]));
	normalised[PROPERTY_INDEX.STARTING_ENTITY] = toStringOrEmpty(source[PROPERTY_INDEX.STARTING_ENTITY]);
	normalised[PROPERTY_INDEX.STARTING_ANIMATION] = toStringOrEmpty(source[PROPERTY_INDEX.STARTING_ANIMATION]);
	normalised[PROPERTY_INDEX.STARTING_OPACITY] = toNumberOrDefault(source[PROPERTY_INDEX.STARTING_OPACITY], 100);
	normalised[PROPERTY_INDEX.DRAW_SELF] = normaliseComboValue(source[PROPERTY_INDEX.DRAW_SELF], DRAW_SELF_OPTIONS, 0);
	normalised[PROPERTY_INDEX.NICKNAME] = toStringOrEmpty(source[PROPERTY_INDEX.NICKNAME]);
	normalised[PROPERTY_INDEX.BLEND_MODE] = normaliseComboValue(source[PROPERTY_INDEX.BLEND_MODE], BLEND_MODE_OPTIONS, 1);

	return normalised;
}

class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
	_initialProperties: readonly JSONValue[];
	properties: JSONValue[];
	projectFileName: string;
	startingEntityName: string;
	startingAnimationName: string;
	startingOpacity: number;
	drawSelf: boolean;
	nicknameInC2: string;
	noPremultiply: boolean;
	isReady: boolean;
	loadError: unknown;
	loadErrorMessage: string;
	projectData: unknown;
	_projectDataPromise: Promise<unknown> | null;
	_didTriggerReady: boolean;
	_didTriggerLoadFailed: boolean;
	_isReleased: boolean;
	entityIndex: number;
	animationIndex: number;
	entity: any;
	animation: any;
	animationLengthMs: number;
	playing: boolean;
	playbackSpeed: number;
	localTimeMs: number;
	_lastTickTimeSec: number | null;
	_fileLookup: Map<string, any>;
	_timelineById: Map<number, any>;
	_poseObjectStates: any[];

	constructor()
	{
		super();
		
		const initProperties = this._getInitProperties();
		this._initialProperties = initProperties ? [...initProperties] : [];
		this.properties = normaliseInitialProperties(this._initialProperties);

		this.projectFileName = this.properties[PROPERTY_INDEX.SCML_FILE] as string;
		this.startingEntityName = this.properties[PROPERTY_INDEX.STARTING_ENTITY] as string;
		this.startingAnimationName = this.properties[PROPERTY_INDEX.STARTING_ANIMATION] as string;
		this.startingOpacity = this.properties[PROPERTY_INDEX.STARTING_OPACITY] as number;
		this.drawSelf = (this.properties[PROPERTY_INDEX.DRAW_SELF] as number) === 1;
		this.nicknameInC2 = this.properties[PROPERTY_INDEX.NICKNAME] as string;
		this.noPremultiply = (this.properties[PROPERTY_INDEX.BLEND_MODE] as number) === 0;

		this.isReady = false;
		this.loadError = null;
		this.loadErrorMessage = "";
		this.projectData = null;
		this._projectDataPromise = null;
		this._didTriggerReady = false;
		this._didTriggerLoadFailed = false;
		this._isReleased = false;

		this.entityIndex = -1;
		this.animationIndex = -1;
		this.entity = null;
		this.animation = null;
		this.animationLengthMs = 0;
		this.playing = true;
		this.playbackSpeed = 1;
		this.localTimeMs = 0;
		this._lastTickTimeSec = null;
		this._fileLookup = new Map();
		this._timelineById = new Map();
		this._poseObjectStates = [];

		// Enable ticking (Addon SDK v2): _tick() runs before events; _tick2() runs after events.
		// https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/addon-sdk-interfaces/isdkinstancebase
		if (typeof this._setTicking === "function")
			this._setTicking(true);

		if (typeof this._setTicking2 === "function")
			this._setTicking2(true);
	}
	
	_release()
	{
		this._isReleased = true;
		super._release();
	}

	_tick()
	{
		this._loadProjectDataIfNeeded();

		if (!this.isReady || !this.animation)
		{
			return;
		}

		const dtSeconds = this._getDtSeconds();
		if (this.playing && dtSeconds > 0)
		{
			this._advanceTime(dtSeconds);
		}

		this._evaluatePose();
	}

	_tick2()
	{
		// TODO (Phase 3): late tick tasks (after events), if needed.
	}
	
	_draw(renderer: IRenderer)
	{
		// TODO (Phase 4): self-draw rendering.
	}

	_getDtSeconds(): number
	{
		const runtime = (this as any).runtime;
		if (runtime && Number.isFinite(runtime.dt))
		{
			return runtime.dt;
		}

		const now = (typeof performance !== "undefined" && performance && typeof performance.now === "function")
			? performance.now() / 1000
			: Date.now() / 1000;

		const last = this._lastTickTimeSec;
		this._lastTickTimeSec = now;

		if (!Number.isFinite(last))
		{
			return 0;
		}

		const dt = now - last;
		return dt > 0 && dt < 0.5 ? dt : 0;
	}

	_advanceTime(dtSeconds: number)
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			return;
		}

		const speed = Number.isFinite(this.playbackSpeed) ? this.playbackSpeed : 1;
		const deltaMs = dtSeconds * 1000 * speed;
		this.localTimeMs += deltaMs;

		const isLooping = this._isAnimationLooping(this.animation);
		if (isLooping)
		{
			this.localTimeMs %= lengthMs;
			if (this.localTimeMs < 0)
			{
				this.localTimeMs += lengthMs;
			}
		}
		else
		{
			this.localTimeMs = clamp(this.localTimeMs, 0, lengthMs);
			if (this.localTimeMs >= lengthMs)
			{
				this.playing = false;
			}
		}
	}

	_isAnimationLooping(animation: any): boolean
	{
		if (!animation || typeof animation !== "object")
		{
			return true;
		}

		const looping = animation.looping;
		if (typeof looping === "boolean")
		{
			return looping;
		}

		if (typeof looping === "number")
		{
			return looping !== 0;
		}

		if (typeof looping === "string")
		{
			return looping.trim().toLowerCase() !== "false";
		}

		return true;
	}

	_evaluatePose()
	{
		const animation = this.animation;
		const projectData = this.projectData as any;
		if (!animation || !projectData)
		{
			this._poseObjectStates.length = 0;
			return;
		}

		const mainline = animation.mainline;
		const keys = mainline && Array.isArray(mainline.key) ? mainline.key : [];
		if (!keys.length)
		{
			this._poseObjectStates.length = 0;
			return;
		}

		const timeMs = this.localTimeMs;
		const mainKeyIndex = this._findKeyIndexForTime(keys, timeMs);
		const mainKey = keys[mainKeyIndex];
		if (!mainKey)
		{
			this._poseObjectStates.length = 0;
			return;
		}

		const boneRefs = Array.isArray(mainKey.bone_ref) ? mainKey.bone_ref : [];
		const objectRefs = Array.isArray(mainKey.object_ref) ? mainKey.object_ref : [];

		const boneRefsById = new Map<number, any>();
		for (const boneRef of boneRefs)
		{
			if (!boneRef)
			{
				continue;
			}

			const id = toFiniteNumber(boneRef.id, NaN);
			if (Number.isFinite(id))
			{
				boneRefsById.set(id, boneRef);
			}
		}

		const boneWorldById = new Map<number, any>();
		for (const boneRef of boneRefs)
		{
			this._resolveBoneTransform(boneRef, timeMs, boneRefsById, boneWorldById);
		}

		const poseObjects = this._poseObjectStates;
		poseObjects.length = 0;

		for (const objectRef of objectRefs)
		{
			const state = this._evaluateObjectRef(objectRef, timeMs, boneRefsById, boneWorldById);
			if (state)
			{
				poseObjects.push(state);
			}
		}

		poseObjects.sort((a: any, b: any) => a.zIndex - b.zIndex);
	}

	_findKeyIndexForTime(keys: any[], timeMs: number): number
	{
		let low = 0;
		let high = keys.length - 1;
		let result = 0;

		while (low <= high)
		{
			const mid = (low + high) >> 1;
			const keyTime = toFiniteNumber(keys[mid].time, 0);
			if (keyTime <= timeMs)
			{
				result = mid;
				low = mid + 1;
			}
			else
			{
				high = mid - 1;
			}
		}

		return result;
	}

	_resolveBoneTransform(boneRef: any, timeMs: number, boneRefsById: Map<number, any>, boneWorldById: Map<number, any>)
	{
		if (!boneRef)
		{
			return null;
		}

		const boneId = toFiniteNumber(boneRef.id, NaN);
		if (!Number.isFinite(boneId))
		{
			return null;
		}

		if (boneWorldById.has(boneId))
		{
			return boneWorldById.get(boneId);
		}

		const timelineId = toFiniteNumber(boneRef.timeline, NaN);
		const keyIndex = toFiniteNumber(boneRef.key, 0);
		const timeline = this._timelineById.get(timelineId);
		const local = this._evaluateTimelineTransform(timeline, keyIndex, timeMs);
		if (!local)
		{
			return null;
		}

		const parentId = toFiniteNumber(boneRef.parent, NaN);
		let world = local;
		if (Number.isFinite(parentId))
		{
			const parentRef = boneRefsById.get(parentId);
			const parentWorld = this._resolveBoneTransform(parentRef, timeMs, boneRefsById, boneWorldById);
			if (parentWorld)
			{
				world = combineTransforms(parentWorld, local);
			}
		}

		boneWorldById.set(boneId, world);
		return world;
	}

	_evaluateObjectRef(objectRef: any, timeMs: number, boneRefsById: Map<number, any>, boneWorldById: Map<number, any>)
	{
		if (!objectRef)
		{
			return null;
		}

		const timelineId = toFiniteNumber(objectRef.timeline, NaN);
		const keyIndex = toFiniteNumber(objectRef.key, 0);
		const timeline = this._timelineById.get(timelineId);
		const evaluated = this._evaluateTimelineObject(timeline, keyIndex, timeMs);
		if (!evaluated)
		{
			return null;
		}

		const parentBoneId = toFiniteNumber(objectRef.parent, NaN);
		let world = evaluated.transform;
		if (Number.isFinite(parentBoneId))
		{
			const parentRef = boneRefsById.get(parentBoneId);
			const parentWorld = this._resolveBoneTransform(parentRef, timeMs, boneRefsById, boneWorldById);
			if (parentWorld)
			{
				world = combineTransforms(parentWorld, world);
			}
		}

		const fileInfo = this._getFileInfo(evaluated.folder, evaluated.file);

		return {
			folder: evaluated.folder,
			file: evaluated.file,
			zIndex: toFiniteNumber(objectRef.z_index, 0),
			x: world.x,
			y: world.y,
			angle: world.angle,
			scaleX: world.scaleX,
			scaleY: world.scaleY,
			alpha: world.alpha,
			pivotX: Number.isFinite(evaluated.pivotX) ? evaluated.pivotX : (fileInfo ? fileInfo.pivotX : 0),
			pivotY: Number.isFinite(evaluated.pivotY) ? evaluated.pivotY : (fileInfo ? fileInfo.pivotY : 0),
			width: fileInfo ? fileInfo.width : 0,
			height: fileInfo ? fileInfo.height : 0,
			name: fileInfo ? fileInfo.name : ""
		};
	}

	_evaluateTimelineTransform(timeline: any, keyIndex: number, timeMs: number)
	{
		const keys = timeline && Array.isArray(timeline.key) ? timeline.key : [];
		if (!keys.length)
		{
			return null;
		}

		const startIndex = clamp(toFiniteNumber(keyIndex, 0), 0, keys.length - 1);
		const startKey = keys[startIndex];
		const nextIndex = (startIndex + 1) % keys.length;
		const nextKey = keys[nextIndex];

		const lengthMs = this.animationLengthMs;
		const startTime = toFiniteNumber(startKey.time, 0);
		let endTime = toFiniteNumber(nextKey.time, startTime);
		let sampleTime = timeMs;

		if (nextIndex === 0)
		{
			endTime += lengthMs;
			if (sampleTime < startTime)
			{
				sampleTime += lengthMs;
			}
		}

		const denom = endTime - startTime;
		const t = denom > 0 ? clamp01((sampleTime - startTime) / denom) : 0;

		const spin = startKey.spin;
		const startBone = startKey.bone || startKey.object || null;
		const endBone = nextKey.bone || nextKey.object || startBone;

		if (!startBone)
		{
			return null;
		}

		const startAngle = toFiniteNumber(startBone.angle, 0);
		const endAngle = toFiniteNumber(endBone.angle, startAngle);
		const spun = spinAngleDegrees(startAngle, endAngle, spin);
		const angleDeg = typeof spun === "number" ? spun : lerp(spun.start, spun.end, t);

		return {
			x: lerp(toFiniteNumber(startBone.x, 0), toFiniteNumber(endBone.x, toFiniteNumber(startBone.x, 0)), t),
			y: lerp(toFiniteNumber(startBone.y, 0), toFiniteNumber(endBone.y, toFiniteNumber(startBone.y, 0)), t),
			angle: degreesToRadians(angleDeg),
			scaleX: lerp(toFiniteNumber(startBone.scale_x, 1), toFiniteNumber(endBone.scale_x, toFiniteNumber(startBone.scale_x, 1)), t),
			scaleY: lerp(toFiniteNumber(startBone.scale_y, 1), toFiniteNumber(endBone.scale_y, toFiniteNumber(startBone.scale_y, 1)), t),
			alpha: lerp(toFiniteNumber(startBone.a, 1), toFiniteNumber(endBone.a, toFiniteNumber(startBone.a, 1)), t)
		};
	}

	_evaluateTimelineObject(timeline: any, keyIndex: number, timeMs: number)
	{
		const keys = timeline && Array.isArray(timeline.key) ? timeline.key : [];
		if (!keys.length)
		{
			return null;
		}

		const startIndex = clamp(toFiniteNumber(keyIndex, 0), 0, keys.length - 1);
		const startKey = keys[startIndex];
		const nextIndex = (startIndex + 1) % keys.length;
		const nextKey = keys[nextIndex];

		const lengthMs = this.animationLengthMs;
		const startTime = toFiniteNumber(startKey.time, 0);
		let endTime = toFiniteNumber(nextKey.time, startTime);
		let sampleTime = timeMs;

		if (nextIndex === 0)
		{
			endTime += lengthMs;
			if (sampleTime < startTime)
			{
				sampleTime += lengthMs;
			}
		}

		const denom = endTime - startTime;
		const t = denom > 0 ? clamp01((sampleTime - startTime) / denom) : 0;

		const spin = startKey.spin;
		const startObj = startKey.object || null;
		const endObj = nextKey.object || startObj;

		if (!startObj)
		{
			return null;
		}

		const startAngle = toFiniteNumber(startObj.angle, 0);
		const endAngle = toFiniteNumber(endObj.angle, startAngle);
		const spun = spinAngleDegrees(startAngle, endAngle, spin);
		const angleDeg = typeof spun === "number" ? spun : lerp(spun.start, spun.end, t);

		const folder = toFiniteNumber(startObj.folder, -1);
		const file = toFiniteNumber(startObj.file, -1);

		return {
			folder,
			file,
			pivotX: toFiniteNumber(startObj.pivot_x, NaN),
			pivotY: toFiniteNumber(startObj.pivot_y, NaN),
			transform: {
				x: lerp(toFiniteNumber(startObj.x, 0), toFiniteNumber(endObj.x, toFiniteNumber(startObj.x, 0)), t),
				y: lerp(toFiniteNumber(startObj.y, 0), toFiniteNumber(endObj.y, toFiniteNumber(startObj.y, 0)), t),
				angle: degreesToRadians(angleDeg),
				scaleX: lerp(toFiniteNumber(startObj.scale_x, 1), toFiniteNumber(endObj.scale_x, toFiniteNumber(startObj.scale_x, 1)), t),
				scaleY: lerp(toFiniteNumber(startObj.scale_y, 1), toFiniteNumber(endObj.scale_y, toFiniteNumber(startObj.scale_y, 1)), t),
				alpha: lerp(toFiniteNumber(startObj.a, 1), toFiniteNumber(endObj.a, toFiniteNumber(startObj.a, 1)), t)
			}
		};
	}

	_getFileInfo(folderId: number, fileId: number)
	{
		if (!Number.isFinite(folderId) || !Number.isFinite(fileId))
		{
			return null;
		}

		return this._fileLookup.get(`${folderId}:${fileId}`) || null;
	}

	_initPlaybackFromProject(projectData: any)
	{
		const entities = projectData && Array.isArray(projectData.entity) ? projectData.entity : [];
		if (!entities.length)
		{
			throw new Error("Spriter: project contains no entities.");
		}

		const preferredEntityName = (this.startingEntityName || "").trim().toLowerCase();
		let entityIndex = 0;

		if (preferredEntityName)
		{
			for (let i = 0; i < entities.length; i++)
			{
				const name = entities[i] && typeof entities[i].name === "string" ? entities[i].name.trim().toLowerCase() : "";
				if (name && name === preferredEntityName)
				{
					entityIndex = i;
					break;
				}
			}
		}

		const entity = entities[entityIndex];
		if (!entity)
		{
			throw new Error("Spriter: failed to select an entity.");
		}

		const animations = Array.isArray(entity.animation) ? entity.animation : [];
		if (!animations.length)
		{
			throw new Error("Spriter: selected entity contains no animations.");
		}

		const preferredAnimName = (this.startingAnimationName || "").trim().toLowerCase();
		let animationIndex = 0;

		if (preferredAnimName)
		{
			for (let i = 0; i < animations.length; i++)
			{
				const name = animations[i] && typeof animations[i].name === "string" ? animations[i].name.trim().toLowerCase() : "";
				if (name && name === preferredAnimName)
				{
					animationIndex = i;
					break;
				}
			}
		}

		const animation = animations[animationIndex];
		if (!animation)
		{
			throw new Error("Spriter: failed to select an animation.");
		}

		const lengthMs = toFiniteNumber(animation.length, 0);
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			throw new Error("Spriter: selected animation has an invalid length.");
		}

		this.entityIndex = entityIndex;
		this.animationIndex = animationIndex;
		this.entity = entity;
		this.animation = animation;
		this.animationLengthMs = lengthMs;

		this.localTimeMs = 0;
		this.playing = true;
		this._lastTickTimeSec = null;

		this._fileLookup.clear();
		const folders = Array.isArray(projectData.folder) ? projectData.folder : [];
		for (const folder of folders)
		{
			const folderId = toFiniteNumber(folder && folder.id, NaN);
			const files = folder && Array.isArray(folder.file) ? folder.file : [];
			if (!Number.isFinite(folderId))
			{
				continue;
			}

			for (const file of files)
			{
				const fileId = toFiniteNumber(file && file.id, NaN);
				if (!Number.isFinite(fileId))
				{
					continue;
				}

				this._fileLookup.set(`${folderId}:${fileId}`, {
					name: typeof file.name === "string" ? file.name : "",
					width: toFiniteNumber(file.width, 0),
					height: toFiniteNumber(file.height, 0),
					pivotX: toFiniteNumber(file.pivot_x, 0),
					pivotY: toFiniteNumber(file.pivot_y, 0)
				});
			}
		}

		this._timelineById.clear();
		const timelines = Array.isArray(animation.timeline) ? animation.timeline : [];
		for (let i = 0; i < timelines.length; i++)
		{
			const timeline = timelines[i];
			const id = toFiniteNumber(timeline && timeline.id, i);
			this._timelineById.set(id, timeline);
		}

		this._evaluatePose();
	}

	_loadProjectDataIfNeeded()
	{
		if (this._isReleased || this.isReady || this.loadError)
		{
			return;
		}

		const projectFileName = normaliseProjectFileName(this.projectFileName);
		if (!projectFileName)
		{
			return;
		}

		if (isPromiseLike(this._projectDataPromise))
		{
			return;
		}

		const sdkType = (this as any).objectType;
		if (!sdkType || typeof sdkType._requestProjectDataLoad !== "function")
		{
			this._setLoadError(new Error("Spriter: object type does not support project loading yet."));
			return;
		}

		const loadPromise = sdkType._requestProjectDataLoad(projectFileName);
		if (!isPromiseLike(loadPromise))
		{
			this._setLoadError(new Error("Spriter: failed to start project load."));
			return;
		}

		this._projectDataPromise = loadPromise;

		loadPromise
			.then((projectData: unknown) =>
			{
				if (this._isReleased)
				{
					return;
				}

				try
				{
					this.projectData = projectData;
					this._initPlaybackFromProject(projectData);
					this.loadError = null;
					this.loadErrorMessage = "";
					this.isReady = true;
					this._triggerOnReady();
				}
				catch (error)
				{
					this._setLoadError(error);
				}
			})
			.catch((error: unknown) =>
			{
				if (this._isReleased)
				{
					return;
				}

				this._setLoadError(error);
			});
	}

	_setLoadError(error: unknown)
	{
		this.loadError = error;
		this.isReady = false;
		this.projectData = null;
		this.loadErrorMessage = error instanceof Error ? error.message : String(error);

		if (!this._didTriggerLoadFailed)
		{
			console.error(`[Spriter] Failed to load project '${this.projectFileName}': ${this.loadErrorMessage}`, error);
			this._triggerOnLoadFailed();
		}
	}

	_triggerOnReady()
	{
		if (this._didTriggerReady)
		{
			return;
		}

		this._didTriggerReady = true;

		const cnds = (C3.Plugins.Spriter as any).Cnds;
		if (typeof (this as any)._trigger === "function" && cnds && typeof cnds.OnReady === "function")
		{
			(this as any)._trigger(cnds.OnReady);
		}
	}

	_triggerOnLoadFailed()
	{
		if (this._didTriggerLoadFailed)
		{
			return;
		}

		this._didTriggerLoadFailed = true;

		const cnds = (C3.Plugins.Spriter as any).Cnds;
		if (typeof (this as any)._trigger === "function" && cnds && typeof cnds.OnLoadFailed === "function")
		{
			(this as any)._trigger(cnds.OnLoadFailed);
		}
	}
	
	_saveToJson()
	{
		return {
			// data to be saved for savegames
		};
	}
	
	_loadFromJson(o: JSONValue)
	{
		// load state for savegames
	}
};

C3.Plugins.Spriter.Instance = SpriterInstance;

export type { SpriterInstance as SDKInstanceClass };
