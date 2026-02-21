const C3 = globalThis.C3;
console.log("[scml runtime: v4]");

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

function normaliseAssetPath(path)
{
	if (typeof path !== "string")
	{
		return "";
	}

	return path.trim().replace(/\\/g, "/");
}

function getDirectoryPath(path)
{
	const normalised = normaliseAssetPath(path);
	const lastSlash = normalised.lastIndexOf("/");
	return lastSlash >= 0 ? normalised.slice(0, lastSlash) : "";
}

function joinPaths(dir, file)
{
	const base = normaliseAssetPath(dir);
	const leaf = normaliseAssetPath(file);

	if (!base)
	{
		return leaf;
	}

	if (!leaf)
	{
		return base;
	}

	return `${base.replace(/\/+$/, "")}/${leaf.replace(/^\/+/, "")}`;
}

function getPathLeaf(path)
{
	const normalised = normaliseAssetPath(path);
	const lastSlash = normalised.lastIndexOf("/");
	return lastSlash >= 0 ? normalised.slice(lastSlash + 1) : normalised;
}

function stripFileExtension(fileName)
{
	const name = typeof fileName === "string" ? fileName : "";
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(0, dot) : name;
}

function soundNameFromAssetPath(path)
{
	const leaf = getPathLeaf(path);
	return stripFileExtension(leaf);
}

function toAtlasImagePath(atlasName)
{
	const normalised = normaliseAssetPath(atlasName);
	if (!normalised)
	{
		return "";
	}

	if (normalised.toLowerCase().endsWith(".png"))
	{
		return normalised;
	}

	const dot = normalised.lastIndexOf(".");
	if (dot > 0)
	{
		return `${normalised.slice(0, dot)}.png`;
	}

	return `${normalised}.png`;
}

function isPromiseLike(value)
{
	return !!(value && typeof value.then === "function");
}

function clamp(value, min, max)
{
	return Math.min(max, Math.max(min, value));
}

function clamp01(value)
{
	return clamp(value, 0, 1);
}

function lerp(a, b, t)
{
	return a + (b - a) * t;
}

function qerp(a, b, c, t)
{
	return lerp(lerp(a, b, t), lerp(b, c, t), t);
}

function cerp(a, b, c, d, t)
{
	return lerp(qerp(a, b, c, t), qerp(b, c, d, t), t);
}

function quartic(a, b, c, d, e, t)
{
	return lerp(cerp(a, b, c, d, t), cerp(b, c, d, e, t), t);
}

function quintic(a, b, c, d, e, f, t)
{
	return lerp(quartic(a, b, c, d, e, t), quartic(b, c, d, e, f, t), t);
}

function sampleCurve(a, b, c, t)
{
	return ((a * t + b) * t + c) * t;
}

function sampleCurveDerivativeX(a, b, c, t)
{
	return (3 * a * t + 2 * b) * t + c;
}

function solveCurveX(a, b, c, x, epsilon)
{
	let t2 = x;

	for (let i = 0; i < 8; i++)
	{
		const x2 = sampleCurve(a, b, c, t2) - x;
		if (Math.abs(x2) < epsilon)
		{
			return t2;
		}

		const d2 = sampleCurveDerivativeX(a, b, c, t2);
		if (Math.abs(d2) < 1e-6)
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
		const x2 = sampleCurve(a, b, c, t2);
		if (Math.abs(x2 - x) < epsilon)
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

function cubicBezierAtTime(t, p1x, p1y, p2x, p2y, duration)
{
	const cx = 3 * p1x;
	const bx = 3 * (p2x - p1x) - cx;
	const ax = 1 - cx - bx;

	const cy = 3 * p1y;
	const by = 3 * (p2y - p1y) - cy;
	const ay = 1 - cy - by;

	const epsilon = 1 / (200 * duration);
	const solved = solveCurveX(ax, bx, cx, t, epsilon);
	return sampleCurve(ay, by, cy, solved);
}

function evaluateCurveT(key, t)
{
	const linearT = clamp01(toFiniteNumber(t, 0));
	const curveTypeRaw = key && typeof key === "object"
		? (typeof key.curve_type === "string"
			? key.curve_type
			: (typeof key.curveType === "string" ? key.curveType : "linear"))
		: "linear";
	const curveType = curveTypeRaw.trim().toLowerCase();

	switch (curveType)
	{
		case "linear":
			return linearT;
		case "quadratic":
			return qerp(0, toFiniteNumber(key.c1, 0), 1, linearT);
		case "cubic":
			return cerp(0, toFiniteNumber(key.c1, 0), toFiniteNumber(key.c2, 0), 1, linearT);
		case "quartic":
			return quartic(0, toFiniteNumber(key.c1, 0), toFiniteNumber(key.c2, 0), toFiniteNumber(key.c3, 0), 1, linearT);
		case "quintic":
			return quintic(0, toFiniteNumber(key.c1, 0), toFiniteNumber(key.c2, 0), toFiniteNumber(key.c3, 0), toFiniteNumber(key.c4, 0), 1, linearT);
		case "bezier":
			return cubicBezierAtTime(
				linearT,
				toFiniteNumber(key.c1, 0),
				toFiniteNumber(key.c2, 0),
				toFiniteNumber(key.c3, 1),
				toFiniteNumber(key.c4, 1),
				1
			);
		case "instant":
			return linearT >= 1 ? 1 : 0;
		default:
			return linearT;
	}
}

function toFiniteNumber(value, defaultValue)
{
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function toBoolean(value, defaultValue = false)
{
	if (typeof value === "boolean")
	{
		return value;
	}

	if (typeof value === "number")
	{
		return value !== 0;
	}

	if (typeof value === "string")
	{
		const trimmed = value.trim().toLowerCase();
		if (trimmed === "true")
		{
			return true;
		}
		if (trimmed === "false")
		{
			return false;
		}
		const numericValue = Number(trimmed);
		if (Number.isFinite(numericValue))
		{
			return numericValue !== 0;
		}
	}

	return defaultValue;
}

function spinAngleDegrees(startDegrees, endDegrees, spin)
{
	let a0 = toFiniteNumber(startDegrees, 0);
	let a1 = toFiniteNumber(endDegrees, a0);

	const direction = toFiniteNumber(spin, 1);
	if (direction === 0)
	{
		return a0;
	}

	// Spriter stores angles in degrees. "spin" controls which direction to rotate.
	// Positive spin: rotate forwards; negative spin: rotate backwards.
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

function degreesToRadians(degrees)
{
	// Legacy plugin converted Spriter angles with "360 - angle" before radians.
	// Equivalent here: negate the radian angle so rotation direction matches old projects.
	return -degrees * (Math.PI / 180);
}

function radiansToDegrees(radians)
{
	return toFiniteNumber(radians, 0) * (180 / Math.PI);
}

function lerpAngleRadiansShortest(a, b, t)
{
	let start = toFiniteNumber(a, 0);
	let end = toFiniteNumber(b, start);
	while (end - start > Math.PI)
	{
		end -= Math.PI * 2;
	}
	while (end - start < -Math.PI)
	{
		end += Math.PI * 2;
	}
	return start + (end - start) * clamp01(toFiniteNumber(t, 0));
}

function combineTransforms(parent, child)
{
	const flipSign = parent.scaleX * parent.scaleY;
	const angle = (flipSign < 0)
		? ((Math.PI * 2) - child.angle) + parent.angle
		: parent.angle + child.angle;
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
	BLEND_MODE: 6,
	DRAW_DEBUG: 7
});

const AUTOMATIC_PAUSE_MODE = Object.freeze({
	NEVER: 0,
	ALL: 1,
	ALL_BUT_SOUND: 2
});

const OVERRIDE_COMPONENT = Object.freeze({
	ANGLE: 0,
	X: 1,
	Y: 2,
	SCALE_X: 3,
	SCALE_Y: 4,
	IMAGE: 5,
	PIVOT_X: 6,
	PIVOT_Y: 7,
	ENTITY_INDEX: 8,
	ANIMATION_INDEX: 9,
	TIME_RATIO: 10
});

const DRAW_SELF_OPTIONS = ["false", "true"];
const BLEND_MODE_OPTIONS = ["no premultiplied alpha blend", "use effects blend mode"];
const DRAW_DEBUG_OPTIONS = ["false", "true"];

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

function callFirstMethod(target, methodNames, ...args)
{
	if (!target)
	{
		return undefined;
	}

	for (const methodName of methodNames)
	{
		const fn = target[methodName];
		if (typeof fn === "function")
		{
			return fn.call(target, ...args);
		}
	}

	return undefined;
}

function toLowerCaseSafe(value)
{
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function doCmp(left, cmp, right)
{
	const a = Number(left);
	const b = Number(right);
	const hasNumbers = Number.isFinite(a) && Number.isFinite(b);

	if (hasNumbers)
	{
		switch (cmp)
		{
			case 0: return a === b;
			case 1: return a !== b;
			case 2: return a < b;
			case 3: return a <= b;
			case 4: return a > b;
			case 5: return a >= b;
			default: break;
		}
	}

	const leftText = String(left ?? "");
	const rightText = String(right ?? "");
	switch (cmp)
	{
		case 0: return leftText === rightText;
		case 1: return leftText !== rightText;
		case 2: return leftText < rightText;
		case 3: return leftText <= rightText;
		case 4: return leftText > rightText;
		case 5: return leftText >= rightText;
		default: return leftText === rightText;
	}
}

function stripEntityPrefix(name, entityName)
{
	const text = toStringOrEmpty(name);
	const entityText = toStringOrEmpty(entityName);
	const prefix = entityText ? `${entityText}_` : "";
	return prefix && text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function normaliseSpriterObjectName(name)
{
	const text = toStringOrEmpty(name).trim();
	const hasSingleQuotes = text.length >= 2 && text.startsWith("'") && text.endsWith("'");
	const hasDoubleQuotes = text.length >= 2 && text.startsWith("\"") && text.endsWith("\"");
	return (hasSingleQuotes || hasDoubleQuotes) ? text.slice(1, -1).trim() : text;
}

function normaliseTimelineLookupName(name, entityName = "")
{
	const raw = normaliseSpriterObjectName(name);
	if (!raw)
	{
		return "";
	}

	const stripped = stripEntityPrefix(raw, entityName);
	return toLowerCaseSafe(stripped || raw);
}

function makeFolderFileKey(folder, file)
{
	return `${folder}:${file}`;
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

function normaliseInitialProperties(initialProperties)
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
	normalised[PROPERTY_INDEX.DRAW_DEBUG] = normaliseComboValue(source[PROPERTY_INDEX.DRAW_DEBUG], DRAW_DEBUG_OPTIONS, 0);

	return normalised;
}

C3.Plugins.Spriter.Instance = class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
	constructor()
	{
		super();

		const initProperties = this._getInitProperties();
		this._initialProperties = initProperties ? [...initProperties] : [];
		this.properties = normaliseInitialProperties(this._initialProperties);

		this.projectFileName = this.properties[PROPERTY_INDEX.SCML_FILE];
		this._rawProjectFileName = toStringOrEmpty(this._initialProperties[PROPERTY_INDEX.SCML_FILE]);
		this._rawProjectDir = getDirectoryPath(this._rawProjectFileName);
		this.startingEntityName = this.properties[PROPERTY_INDEX.STARTING_ENTITY];
		this.startingAnimationName = this.properties[PROPERTY_INDEX.STARTING_ANIMATION];
		this.startingOpacity = this.properties[PROPERTY_INDEX.STARTING_OPACITY];
		this.drawSelf = this.properties[PROPERTY_INDEX.DRAW_SELF] === 1;
		this.nicknameInC2 = this.properties[PROPERTY_INDEX.NICKNAME];
		this.noPremultiply = this.properties[PROPERTY_INDEX.BLEND_MODE] === 0;
		this.drawDebug = this.properties[PROPERTY_INDEX.DRAW_DEBUG] === 1;

		const startupWorldInfo = (typeof this.GetWorldInfo === "function")
			? this.GetWorldInfo()
			: (typeof this.getWorldInfo === "function")
				? this.getWorldInfo()
				: null;
		const startupGetWidth = startupWorldInfo
			? (typeof startupWorldInfo.GetWidth === "function")
				? startupWorldInfo.GetWidth.bind(startupWorldInfo)
				: (typeof startupWorldInfo.getWidth === "function")
					? startupWorldInfo.getWidth.bind(startupWorldInfo)
					: null
			: null;
		const startupWidth = startupGetWidth ? startupGetWidth() : toFiniteNumber(this.width, 50);
		const startupScaleRatio = toFiniteNumber(startupWidth, 50) / 50;
		// Legacy behaviour: startup object width defines the global Spriter scale ratio.
		this._globalScaleRatio = (Number.isFinite(startupScaleRatio) && startupScaleRatio !== 0) ? startupScaleRatio : 1;
		this._xFlip = false;
		this._yFlip = false;
		this.ignoreGlobalTimeScale = false;

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
		this.secondAnimation = null;
		this.animBlend = 0;
		this._autoBlendActive = false;
		this._autoBlendStartFrom = 0;
		this._autoBlendDurationMs = 0;
		this._autoBlendElapsedMs = 0;
		this._autoBlendPrimaryPoseTimeMs = 0;
		this._autoBlendTargetAnimationIndex = -1;
		this.lastFoundObject = "";

		this.playing = true;
		this.playbackSpeed = 1;
		this.localTimeMs = 0;
		this._currentAdjustedTimeMs = 0;
		this._currentMainlineKeyIndex = 0;
		this._playToTimeMs = -1;
		this._loopOverrideByAnimationIndex = new Map();
		this._pendingLoopOverride = null;
		this._lastTickTimeSec = null;

		this._fileLookup = new Map();
		this._timelineById = new Map();
		this._poseObjectStates = [];
		this._poseBoneStates = [];
		this._soundLines = [];
		this._soundStateByName = new Map();
		this._triggeredSoundName = "";
		this._triggeredSoundTag = "";
		this._atlasFrameCache = new Map();
		this._atlasTextureLoadState = new Map();
		this._atlasImagePathByIndex = new Map();
		this._atlasDebug = {
			loggedMissingMetadata: false,
			loggedFirstAtlasDraw: false,
			loggedProjectAtlasFallback: false,
			loggedFrameLookupIssue: false,
			missingFrameIndices: new Set(),
			missingAtlasImageIndices: new Set(),
			pendingTextureIndices: new Set()
		};

		// Non-self-draw state
		this._objectArray = [];
		this._c2ObjectMap = new Map();
		this._objectsToSet = [];
		this._timelineNameById = new Map();
		this._nonSelfDrawDiagDone = false;
		this._didWarnSpriteFrameApiUnavailable = false;
		this.setLayersForSprites = true;
		this.setVisibilityForObjects = true;
		this.setCollisionsForObjects = true;

		// Legacy compatibility state (character maps, overrides, events, vars/tags, viewport pausing).
		this._characterMapsByName = new Map();
		this._activeCharMapNames = [];
		this._resolvedCharMapByObject = new Map();
		this._resolvedCharMapGlobal = new Map();
		this._objectInfoByName = new Map();
		this._boneLengthByTimelineName = new Map();
		this._objectOverridesByName = new Map();
		this._boneIkOverridesByName = new Map();
		this._eventLines = [];
		this._triggeredEventName = "";
		this._varDefsById = new Map();
		this._varDefsByName = new Map();
		this._varDefsByScope = new Map();
		this._tagDefs = [];
		this._activeTagsByScope = new Map();
		this._varValuesByScope = new Map();
		this._autoPauseMode = AUTOMATIC_PAUSE_MODE.NEVER;
		this._autoPauseLeftBuffer = 0;
		this._autoPauseRightBuffer = 0;
		this._autoPauseTopBuffer = 0;
		this._autoPauseBottomBuffer = 0;

		// Enable ticking (Addon SDK v2): _tick() runs before events; _tick2() runs after events.
		// https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/addon-sdk-interfaces/isdkinstancebase
		if (typeof this._setTicking === "function")
			this._setTicking(true);

		if (typeof this._setTicking2 === "function")
			this._setTicking2(true);

		// Recreate textures if the renderer context is lost (e.g. WebGL context loss).
		if (typeof this._handleRendererContextLoss === "function")
			this._handleRendererContextLoss();
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
			if (this._advanceTime(dtSeconds))
			{
				this._triggerAnimationFinished();
			}
			this._advanceAutoBlend(dtSeconds);
		}

		const outsideViewport = this._isOutsideViewportBox();
		const pauseAll = outsideViewport && this._autoPauseMode === AUTOMATIC_PAUSE_MODE.ALL;
		const pauseAllButSound = outsideViewport && this._autoPauseMode === AUTOMATIC_PAUSE_MODE.ALL_BUT_SOUND;

		if (!pauseAllButSound)
		{
			this._evaluatePose();
			this._refreshMetaState(this._currentAdjustedTimeMs);

			if (!this.drawSelf)
			{
				this._applyPoseToInstances();
			}
		}

		if (pauseAll)
		{
			return;
		}

		this._evaluateSoundLines(this._currentAdjustedTimeMs);
		this._evaluateEventLines(this._currentAdjustedTimeMs);

		// Keep vars/tags in sync while paused by viewport optimization modes.
		if (pauseAllButSound)
		{
			this._refreshMetaState(this._currentAdjustedTimeMs);
		}
	}

	_tick2()
	{
		this._applyObjectsToSet();
	}
	
	_draw(renderer)
	{
		if (!this.drawSelf || !renderer)
		{
			return;
		}

		const poseObjects = Array.isArray(this._poseObjectStates) ? this._poseObjectStates : [];
		const poseBones = Array.isArray(this._poseBoneStates) ? this._poseBoneStates : [];
		if (!poseObjects.length && !(this.drawDebug && poseBones.length))
		{
			return;
		}

		const worldInfo = (typeof this.GetWorldInfo === "function")
			? this.GetWorldInfo()
			: (typeof this.getWorldInfo === "function")
				? this.getWorldInfo()
				: null;

		// Blend mode: match existing C3 behaviour where possible.
		const getBlendMode = worldInfo
			? (typeof worldInfo.GetBlendMode === "function")
				? worldInfo.GetBlendMode.bind(worldInfo)
				: (typeof worldInfo.getBlendMode === "function")
					? worldInfo.getBlendMode.bind(worldInfo)
					: null
			: null;

		if (this.noPremultiply && typeof renderer.SetNoPremultiplyAlphaBlend === "function")
		{
			renderer.SetNoPremultiplyAlphaBlend();
		}
		else if (typeof renderer.SetBlendMode === "function" && getBlendMode)
		{
			renderer.SetBlendMode(getBlendMode());
		}
		else if (typeof renderer.setBlendMode === "function" && getBlendMode)
		{
			renderer.setBlendMode(getBlendMode());
		}
		else if (typeof renderer.SetAlphaBlend === "function")
		{
			renderer.SetAlphaBlend();
		}
		else if (typeof renderer.setAlphaBlendMode === "function")
		{
			renderer.setAlphaBlendMode();
		}

		const setColorFillMode = (typeof renderer.SetColorFillMode === "function")
			? renderer.SetColorFillMode.bind(renderer)
			: (typeof renderer.setColorFillMode === "function")
				? renderer.setColorFillMode.bind(renderer)
				: null;

		const setTextureFillMode = (typeof renderer.SetTextureFillMode === "function")
			? renderer.SetTextureFillMode.bind(renderer)
			: (typeof renderer.setTextureFillMode === "function")
				? renderer.setTextureFillMode.bind(renderer)
				: null;

		const setTexture = (typeof renderer.SetTexture === "function")
			? renderer.SetTexture.bind(renderer)
			: (typeof renderer.setTexture === "function")
				? renderer.setTexture.bind(renderer)
				: null;

		// Default to debug quads until textures are ready.
		let fillMode = "";
		if (setColorFillMode)
		{
			setColorFillMode();
			fillMode = "color";
		}

		const getX = worldInfo
			? (typeof worldInfo.GetX === "function")
				? worldInfo.GetX.bind(worldInfo)
				: (typeof worldInfo.getX === "function")
					? worldInfo.getX.bind(worldInfo)
					: null
			: null;
		const getY = worldInfo
			? (typeof worldInfo.GetY === "function")
				? worldInfo.GetY.bind(worldInfo)
				: (typeof worldInfo.getY === "function")
					? worldInfo.getY.bind(worldInfo)
					: null
			: null;
		const getAngle = worldInfo
			? (typeof worldInfo.GetAngle === "function")
				? worldInfo.GetAngle.bind(worldInfo)
				: (typeof worldInfo.getAngle === "function")
					? worldInfo.getAngle.bind(worldInfo)
					: null
			: null;

		const instX = getX ? getX() : toFiniteNumber(this.x, 0);
		const instY = getY ? getY() : toFiniteNumber(this.y, 0);
		const instAngle = getAngle ? getAngle() : toFiniteNumber(this.angle, 0);

		const mirrorFactor = this._xFlip ? -1 : 1;
		const flipFactor = this._yFlip ? -1 : 1;
		const rootTransform = {
			x: instX,
			y: instY,
			angle: Number.isFinite(instAngle) ? instAngle : 0,
			scaleX: toFiniteNumber(this._globalScaleRatio, 1) * mirrorFactor,
			scaleY: toFiniteNumber(this._globalScaleRatio, 1) * flipFactor,
			alpha: 1
		};

		// In SDK v2 runtime, renderer.quad(...) expects a DOMQuad-like object (p1..p4).
		// Passing a C3.Quad to renderer.quad(...) throws in C3.Quad.fromDOMQuad, so only use
		// C3 geometry types when using the legacy-style renderer APIs (Quad3/Quad4).
		const quadDom = (typeof renderer.quad === "function") ? renderer.quad.bind(renderer) : null;
		const quadC3 = (typeof renderer.Quad === "function") ? renderer.Quad.bind(renderer) : null;
		const quad3C3 = (typeof renderer.Quad3 === "function") ? renderer.Quad3.bind(renderer) : null;
		const quad3Dom = (typeof renderer.quad3 === "function") ? renderer.quad3.bind(renderer) : null;

		const geometryQuad = (!quadDom && (quadC3 || quad3C3) && C3 && C3.Quad) ? new C3.Quad() : null;
		const boundingRect = (!quadDom && (quadC3 || quad3C3) && C3 && C3.Rect) ? new C3.Rect() : null;

		const setColorRgba = (typeof renderer.SetColorRgba === "function")
			? renderer.SetColorRgba.bind(renderer)
			: (typeof renderer.setColorRgba === "function")
				? renderer.setColorRgba.bind(renderer)
				: null;

		const setOpacity = (typeof renderer.SetOpacity === "function")
			? renderer.SetOpacity.bind(renderer)
			: (typeof renderer.setOpacity === "function")
				? renderer.setOpacity.bind(renderer)
				: null;

		const quad3 = quad3C3 || quad3Dom;
		const quad = quadDom || quadC3;
		const fullTexRect = { x: 0, y: 0, width: 1, height: 1, left: 0, top: 0, right: 1, bottom: 1 };
		const debugSpriteOverlays = this.drawDebug ? [] : null;

		const renderDebugQuad = (domDebugQuad, r, g, b, a) =>
		{
			if (!domDebugQuad || !setColorRgba || !setColorFillMode)
			{
				return;
			}

			if (fillMode !== "color")
			{
				setColorFillMode();
				fillMode = "color";
			}

			setColorRgba(r, g, b, a);
			if (quadDom)
			{
				quadDom(domDebugQuad);
			}
			else if (quad3Dom)
			{
				quad3Dom(domDebugQuad, fullTexRect);
			}
		};

		const makeLineQuad = (x1, y1, x2, y2, halfThickness) =>
		{
			const dx = x2 - x1;
			const dy = y2 - y1;
			const len = Math.hypot(dx, dy);
			const half = Math.max(0.25, toFiniteNumber(halfThickness, 1));

			if (len <= 1e-6)
			{
				return {
					p1: { x: x1 - half, y: y1 - half, z: 0, w: 1 },
					p2: { x: x1 + half, y: y1 - half, z: 0, w: 1 },
					p3: { x: x1 + half, y: y1 + half, z: 0, w: 1 },
					p4: { x: x1 - half, y: y1 + half, z: 0, w: 1 }
				};
			}

			const ux = dx / len;
			const uy = dy / len;
			const px = -uy * half;
			const py = ux * half;

			return {
				p1: { x: x1 + px, y: y1 + py, z: 0, w: 1 },
				p2: { x: x2 + px, y: y2 + py, z: 0, w: 1 },
				p3: { x: x2 - px, y: y2 - py, z: 0, w: 1 },
				p4: { x: x1 - px, y: y1 - py, z: 0, w: 1 }
			};
		};

		const makeDotQuad = (x, y, radius) =>
		{
			const r = Math.max(0.5, toFiniteNumber(radius, 1.5));
			return {
				p1: { x: x - r, y: y - r, z: 0, w: 1 },
				p2: { x: x + r, y: y - r, z: 0, w: 1 },
				p3: { x: x + r, y: y + r, z: 0, w: 1 },
				p4: { x: x - r, y: y + r, z: 0, w: 1 }
			};
		};

		const sdkType = this.objectType;
		const getOrLoadTexture = sdkType && typeof sdkType._getOrLoadTextureForPath === "function"
			? sdkType._getOrLoadTextureForPath.bind(sdkType)
			: null;
		const hasTextureError = sdkType && typeof sdkType._hasTextureErrorForPath === "function"
			? sdkType._hasTextureErrorForPath.bind(sdkType)
			: null;
		const getTextureSize = sdkType && typeof sdkType._getTextureSizeForPath === "function"
			? sdkType._getTextureSizeForPath.bind(sdkType)
			: null;

		const baseOpacity = clamp01(this.startingOpacity / 100);

		for (let i = 0, len = poseObjects.length; i < len; i++)
		{
			const state = poseObjects[i];
			if (!state)
			{
				continue;
			}

			const widthRaw = toFiniteNumber(state.width, 0);
			const heightRaw = toFiniteNumber(state.height, 0);
			const width = widthRaw > 0 ? widthRaw : 50;
			const height = heightRaw > 0 ? heightRaw : 50;

			const world = combineTransforms(rootTransform, {
				x: toFiniteNumber(state.x, 0),
				y: toFiniteNumber(state.y, 0),
				angle: toFiniteNumber(state.angle, 0),
				scaleX: toFiniteNumber(state.scaleX, 1),
				scaleY: toFiniteNumber(state.scaleY, 1),
				alpha: toFiniteNumber(state.alpha, 1)
			});

			let pivotX = clamp01(toFiniteNumber(state.pivotX, 0));
			let pivotY = clamp01(toFiniteNumber(state.pivotY, 0));

			let scaleX = toFiniteNumber(world.scaleX, 1);
			let scaleY = toFiniteNumber(world.scaleY, 1);

			const scaledW = width * scaleX;
			const scaledH = height * scaleY;
			if (!Number.isFinite(scaledW) || !Number.isFinite(scaledH) || scaledW === 0 || scaledH === 0)
			{
				continue;
			}

			const baseX = toFiniteNumber(world.x, 0);
			const baseY = toFiniteNumber(world.y, 0);
			const angle = toFiniteNumber(world.angle, 0);

			const left = baseX - pivotX * scaledW;
			const top = baseY - pivotY * scaledH;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);

			const tlx = left;
			const tly = top;
			const trx = left + scaledW;
			const try_ = top;
			const brx = left + scaledW;
			const bry = top + scaledH;
			const blx = left;
			const bly = top + scaledH;

			const dx1 = tlx - baseX;
			const dy1 = tly - baseY;
			const dx2 = trx - baseX;
			const dy2 = try_ - baseY;
			const dx3 = brx - baseX;
			const dy3 = bry - baseY;
			const dx4 = blx - baseX;
			const dy4 = bly - baseY;

			const domQuad = {
				p1: { x: baseX + dx1 * cos - dy1 * sin, y: baseY + dx1 * sin + dy1 * cos, z: 0, w: 1 },
				p2: { x: baseX + dx2 * cos - dy2 * sin, y: baseY + dx2 * sin + dy2 * cos, z: 0, w: 1 },
				p3: { x: baseX + dx3 * cos - dy3 * sin, y: baseY + dx3 * sin + dy3 * cos, z: 0, w: 1 },
				p4: { x: baseX + dx4 * cos - dy4 * sin, y: baseY + dx4 * sin + dy4 * cos, z: 0, w: 1 }
			};

			const alpha = clamp01(toFiniteNumber(world.alpha, 1) * baseOpacity);
			if (alpha <= 0)
			{
				continue;
			}

			if (debugSpriteOverlays)
			{
				debugSpriteOverlays.push({
					quad: domQuad,
					x: baseX,
					y: baseY,
					alpha
				});
			}

			// Prefer atlas-based self draw (legacy behaviour): draw from this object's own frames using SCON atlas metadata.
			const atlasW = toFiniteNumber(state.atlasW, 0);
			const atlasH = toFiniteNumber(state.atlasH, 0);
			const hasAtlas = atlasW > 0 && atlasH > 0;
			const hasAtlasList = !!(this.projectData && Array.isArray(this.projectData.atlas) && this.projectData.atlas.length);

			if (!hasAtlas && hasAtlasList && this._atlasDebug && !this._atlasDebug.loggedMissingMetadata)
			{
				this._atlasDebug.loggedMissingMetadata = true;
				console.warn(`[Spriter] Atlas metadata missing for '${state.name || "(unnamed)"}' (aw/ah/ax/ay not set). Using debug fallback.`);
			}

			if (hasAtlas && quad3Dom && setTextureFillMode && setTexture)
			{
				const atlasIndexRaw = toFiniteNumber(state.atlasIndex, 0);
				const atlasIndex = Number.isInteger(atlasIndexRaw) ? atlasIndexRaw : Math.trunc(atlasIndexRaw);
				const atlasImagePathFromProject = this._atlasImagePathByIndex
					? this._atlasImagePathByIndex.get(atlasIndex) || ""
					: "";

				const frame = this._getAtlasFrame(atlasIndex);
				if (!frame && this._atlasDebug && !this._atlasDebug.missingFrameIndices.has(atlasIndex))
				{
					this._atlasDebug.missingFrameIndices.add(atlasIndex);
					console.warn(`[Spriter] No atlas frame found at index ${atlasIndex}; using debug fallback.`);
				}

				const imageInfo = frame && typeof frame.GetImageInfo === "function"
					? frame.GetImageInfo()
					: frame && typeof frame.getImageInfo === "function"
						? frame.getImageInfo()
						: frame && frame._imageInfo
							? frame._imageInfo
							: null;

				let texture = imageInfo && typeof imageInfo.GetTexture === "function"
					? imageInfo.GetTexture()
					: imageInfo && typeof imageInfo.getTexture === "function"
						? imageInfo.getTexture()
						: null;

				// In some runtimes, atlas frame textures aren't ready until LoadStaticTexture() runs.
				// Request it once per atlas frame and fall back to debug quads until it resolves.
				if (!texture && imageInfo)
				{
					this._requestAtlasTextureLoad(atlasIndex, imageInfo, renderer);
					if (this._atlasDebug && !this._atlasDebug.pendingTextureIndices.has(atlasIndex))
					{
						this._atlasDebug.pendingTextureIndices.add(atlasIndex);
						console.log(`[Spriter] Atlas texture not ready for frame ${atlasIndex}; requested async texture load.`);
					}
				}

				let imageWidth = toFiniteNumber(
					imageInfo && typeof imageInfo.GetWidth === "function"
						? imageInfo.GetWidth()
						: imageInfo && imageInfo._width,
					0
				);

				let imageHeight = toFiniteNumber(
					imageInfo && typeof imageInfo.GetHeight === "function"
						? imageInfo.GetHeight()
						: imageInfo && imageInfo._height,
					0
				);

				let texRect = imageInfo && typeof imageInfo.GetTexRect === "function"
					? imageInfo.GetTexRect()
					: imageInfo && typeof imageInfo.getTexRect === "function"
						? imageInfo.getTexRect()
						: null;

				if ((!texture || imageWidth <= 0 || imageHeight <= 0) && atlasImagePathFromProject && getOrLoadTexture)
				{
					let atlasImagePath = atlasImagePathFromProject;
					let projectTexture = getOrLoadTexture(atlasImagePath, renderer);

					if (!projectTexture && hasTextureError && hasTextureError(atlasImagePath))
					{
						const slash = atlasImagePath.lastIndexOf("/");
						if (slash >= 0)
						{
							const leafPath = atlasImagePath.slice(slash + 1);
							if (leafPath && leafPath !== atlasImagePath)
							{
								const leafTexture = getOrLoadTexture(leafPath, renderer);
								if (leafTexture)
								{
									atlasImagePath = leafPath;
									projectTexture = leafTexture;
								}
							}
						}
					}

					if (!projectTexture && hasTextureError && this._rawProjectDir && hasTextureError(atlasImagePath))
					{
						const altPath = joinPaths(this._rawProjectDir, atlasImagePath);
						if (altPath && altPath !== atlasImagePath)
						{
							atlasImagePath = altPath;
							projectTexture = getOrLoadTexture(atlasImagePath, renderer);
						}
					}

					if (projectTexture)
					{
						texture = projectTexture;
						texRect = fullTexRect;

						const textureSize = getTextureSize ? getTextureSize(atlasImagePath) : null;
						imageWidth = textureSize ? toFiniteNumber(textureSize.width, 0) : 0;
						imageHeight = textureSize ? toFiniteNumber(textureSize.height, 0) : 0;

						if (this._atlasDebug && !this._atlasDebug.loggedProjectAtlasFallback)
						{
							this._atlasDebug.loggedProjectAtlasFallback = true;
							console.log("[Spriter] Atlas frame API unavailable; using project-file atlas texture fallback.");
						}
					}
					else if (this._atlasDebug && !this._atlasDebug.missingAtlasImageIndices.has(atlasIndex))
					{
						this._atlasDebug.missingAtlasImageIndices.add(atlasIndex);
						console.warn(`[Spriter] Atlas project texture not ready for index ${atlasIndex} ('${atlasImagePathFromProject}').`);
					}
				}

				if (texture && imageWidth > 0 && imageHeight > 0)
				{
					const texLeft = toFiniteNumber(texRect && (texRect._left ?? texRect.left), 0);
					const texRight = toFiniteNumber(texRect && (texRect._right ?? texRect.right), 1);
					const texTop = toFiniteNumber(texRect && (texRect._top ?? texRect.top), 0);
					const texBottom = toFiniteNumber(texRect && (texRect._bottom ?? texRect.bottom), 1);

					const atlasX = toFiniteNumber(state.atlasX, 0);
					const atlasY = toFiniteNumber(state.atlasY, 0);
					const atlasXOff = toFiniteNumber(state.atlasXOff, 0);
					const atlasYOff = toFiniteNumber(state.atlasYOff, 0);
					const atlasRotated = !!state.atlasRotated;

					let uvW = atlasW;
					let uvH = atlasH;
					let drawAngle = angle;

					if (atlasRotated)
					{
						drawAngle -= Math.PI / 2;
						uvW = atlasH;
						uvH = atlasW;
					}

					const uvLeft = atlasX / imageWidth;
					const uvTop = atlasY / imageHeight;
					const uvRight = (atlasX + uvW) / imageWidth;
					const uvBottom = (atlasY + uvH) / imageHeight;

					const u0 = lerp(texLeft, texRight, uvLeft);
					const u1 = lerp(texLeft, texRight, uvRight);
					const v0 = lerp(texTop, texBottom, uvTop);
					const v1 = lerp(texTop, texBottom, uvBottom);

					const uvRect = {
						x: u0,
						y: v0,
						width: u1 - u0,
						height: v1 - v0,
						left: u0,
						top: v0,
						right: u1,
						bottom: v1
					};

					const absPivotX = pivotX * width * scaleX;
					const absPivotY = pivotY * height * scaleY;
					const reverseAbsPivotX = (1 - pivotX) * width * scaleX;
					const reverseAbsPivotY = (1 - pivotY) * height * scaleY;

					const xOff = scaleX * atlasXOff;
					const yOff = scaleY * atlasYOff;
					const reverseXOff = scaleX * (width - (atlasXOff + atlasW));
					const reverseYOff = scaleY * (height - (atlasYOff + atlasH));

					let rectLeft = baseX;
					let rectTop = baseY;
					let rectRight;
					let rectBottom;
					let offsetX;
					let offsetY;

					if (atlasRotated)
					{
						rectRight = baseX + atlasH * scaleY;
						rectBottom = baseY + atlasW * scaleX;
						offsetX = reverseYOff - reverseAbsPivotY;
						offsetY = xOff - absPivotX;
					}
					else
					{
						rectRight = baseX + atlasW * scaleX;
						rectBottom = baseY + atlasH * scaleY;
						offsetX = xOff - absPivotX;
						offsetY = yOff - absPivotY;
					}

					rectLeft += offsetX;
					rectRight += offsetX;
					rectTop += offsetY;
					rectBottom += offsetY;

					const cosA = Math.cos(drawAngle);
					const sinA = Math.sin(drawAngle);

					const atlTlx = rectLeft;
					const atlTly = rectTop;
					const atlTrx = rectRight;
					const atlTry = rectTop;
					const atlBrx = rectRight;
					const atlBry = rectBottom;
					const atlBlx = rectLeft;
					const atlBly = rectBottom;

					const adx1 = atlTlx - baseX;
					const ady1 = atlTly - baseY;
					const adx2 = atlTrx - baseX;
					const ady2 = atlTry - baseY;
					const adx3 = atlBrx - baseX;
					const ady3 = atlBry - baseY;
					const adx4 = atlBlx - baseX;
					const ady4 = atlBly - baseY;

					const atlasDomQuad = {
						p1: { x: baseX + adx1 * cosA - ady1 * sinA, y: baseY + adx1 * sinA + ady1 * cosA, z: 0, w: 1 },
						p2: { x: baseX + adx2 * cosA - ady2 * sinA, y: baseY + adx2 * sinA + ady2 * cosA, z: 0, w: 1 },
						p3: { x: baseX + adx3 * cosA - ady3 * sinA, y: baseY + adx3 * sinA + ady3 * cosA, z: 0, w: 1 },
						p4: { x: baseX + adx4 * cosA - ady4 * sinA, y: baseY + adx4 * sinA + ady4 * cosA, z: 0, w: 1 }
					};

					if (fillMode !== "texture")
					{
						setTextureFillMode();
						fillMode = "texture";
					}

					setTexture(texture);

					if (this.noPremultiply && setOpacity)
					{
						setOpacity(alpha);
					}
					else if (setColorRgba)
					{
						setColorRgba(1, 1, 1, alpha);
					}

					quad3Dom(atlasDomQuad, uvRect);
					if (this._atlasDebug && !this._atlasDebug.loggedFirstAtlasDraw)
					{
						this._atlasDebug.loggedFirstAtlasDraw = true;
						console.log(`[Spriter] Atlas textured draw active (index ${atlasIndex}).`);
					}
					continue;
				}
			}

			if (!hasAtlas)
			{
				// Try to draw the actual Spriter image if it exists as a Construct project file.
				const imageName = normaliseAssetPath(state.name);
				let texture = null;

				if (getOrLoadTexture && imageName)
				{
					texture = getOrLoadTexture(imageName, renderer);

					// If the image path is relative to the .scon file's folder, try that on failure.
					if (!texture && hasTextureError && this._rawProjectDir && hasTextureError(imageName))
					{
						const altPath = joinPaths(this._rawProjectDir, imageName);
						if (altPath && altPath !== imageName)
						{
							texture = getOrLoadTexture(altPath, renderer);
						}
					}
				}

				if (texture && quad3Dom && setTextureFillMode && setTexture)
				{
					if (fillMode !== "texture")
					{
						setTextureFillMode();
						fillMode = "texture";
					}

					setTexture(texture);

					if (this.noPremultiply && setOpacity)
					{
						setOpacity(alpha);
					}
					else if (setColorRgba)
					{
						setColorRgba(1, 1, 1, alpha);
					}

					quad3Dom(domQuad, fullTexRect);
					continue;
				}
			}

			// Fallback: debug quads (also used while textures are still loading).
			if (fillMode !== "color" && setColorFillMode)
			{
				setColorFillMode();
				fillMode = "color";
			}

			if (setColorRgba)
			{
				const seed = (toFiniteNumber(state.file, i) * 97 + toFiniteNumber(state.folder, 0) * 57 + i * 13) | 0;
				const r = ((seed >> 0) & 0xFF) / 255;
				const g = ((seed >> 8) & 0xFF) / 255;
				const b = ((seed >> 16) & 0xFF) / 255;
				setColorRgba(r, g, b, alpha * 0.7);
			}

			if (quadDom)
			{
				quadDom(domQuad);
			}
			else if (quadC3 && geometryQuad && boundingRect)
			{
				boundingRect.set(left, top, left + scaledW, top + scaledH);
				boundingRect.offset(-baseX, -baseY);
				geometryQuad.setFromRotatedRect(boundingRect, angle);
				geometryQuad.offset(baseX, baseY);
				quadC3(geometryQuad);
			}
			else if (quad3C3 && geometryQuad && boundingRect)
			{
				boundingRect.set(left, top, left + scaledW, top + scaledH);
				boundingRect.offset(-baseX, -baseY);
				geometryQuad.setFromRotatedRect(boundingRect, angle);
				geometryQuad.offset(baseX, baseY);
				geometryQuad.getBoundingBox(boundingRect);
				boundingRect.normalize();
				quad3C3(geometryQuad, boundingRect);
			}
			else if (quad3Dom)
			{
				quad3Dom(domQuad, { x: 0, y: 0, width: 1, height: 1, left: 0, top: 0, right: 1, bottom: 1 });
			}
		}

		if (this.drawDebug && setColorFillMode && setColorRgba)
		{
			const toRootWorldPoint = (x, y) =>
			{
				const dx = toFiniteNumber(x, 0) * rootTransform.scaleX;
				const dy = toFiniteNumber(y, 0) * rootTransform.scaleY;
				const cosR = Math.cos(rootTransform.angle);
				const sinR = Math.sin(rootTransform.angle);

				return {
					x: rootTransform.x + dx * cosR - dy * sinR,
					y: rootTransform.y + dx * sinR + dy * cosR
				};
			};

			const boneById = new Map();
			for (const bone of poseBones)
			{
				if (!bone)
				{
					continue;
				}

				const id = toFiniteNumber(bone.id, NaN);
				if (Number.isFinite(id))
				{
					boneById.set(id, bone);
				}
			}

			for (const bone of poseBones)
			{
				if (!bone)
				{
					continue;
				}

				const child = toRootWorldPoint(bone.x, bone.y);
				const parentId = toFiniteNumber(bone.parentId, NaN);
				if (Number.isFinite(parentId))
				{
					const parentBone = boneById.get(parentId);
					if (parentBone)
					{
						const parent = toRootWorldPoint(parentBone.x, parentBone.y);
						renderDebugQuad(makeLineQuad(parent.x, parent.y, child.x, child.y, 3), 0.15, 0.85, 1, 0.35);
					}
				}

				renderDebugQuad(makeDotQuad(child.x, child.y, 2.25), 0.15, 0.85, 1, 0.75);
			}

			if (debugSpriteOverlays)
			{
				for (const overlay of debugSpriteOverlays)
				{
					if (!overlay || !overlay.quad)
					{
						continue;
					}

					const q = overlay.quad;
					const boxAlpha = clamp01(toFiniteNumber(overlay.alpha, 1) * 0.9);

					renderDebugQuad(makeLineQuad(q.p1.x, q.p1.y, q.p2.x, q.p2.y, 1.25), 1, 0.55, 0.15, boxAlpha);
					renderDebugQuad(makeLineQuad(q.p2.x, q.p2.y, q.p3.x, q.p3.y, 1.25), 1, 0.55, 0.15, boxAlpha);
					renderDebugQuad(makeLineQuad(q.p3.x, q.p3.y, q.p4.x, q.p4.y, 1.25), 1, 0.55, 0.15, boxAlpha);
					renderDebugQuad(makeLineQuad(q.p4.x, q.p4.y, q.p1.x, q.p1.y, 1.25), 1, 0.55, 0.15, boxAlpha);
					renderDebugQuad(makeDotQuad(overlay.x, overlay.y, 2), 1, 0.2, 0.2, 0.9);
				}
			}
		}
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

		const sdkType = this.objectType;
		if (sdkType && typeof sdkType._getAtlasFrame === "function")
		{
			const typeFrame = sdkType._getAtlasFrame(atlasIndex);
			if (typeFrame)
			{
				this._atlasFrameCache.set(atlasIndex, typeFrame);
				return typeFrame;
			}
		}

		const getObjectClass = typeof this.GetObjectClass === "function"
			? this.GetObjectClass.bind(this)
			: typeof this.getObjectClass === "function"
				? this.getObjectClass.bind(this)
				: null;

		if (!getObjectClass)
		{
			if (this._atlasDebug && !this._atlasDebug.loggedFrameLookupIssue)
			{
				this._atlasDebug.loggedFrameLookupIssue = true;
				console.warn("[Spriter] Atlas frame lookup: GetObjectClass/getObjectClass is unavailable on instance.");
			}
			return null;
		}

		const objectClass = getObjectClass();
		if (!objectClass)
		{
			if (this._atlasDebug && !this._atlasDebug.loggedFrameLookupIssue)
			{
				this._atlasDebug.loggedFrameLookupIssue = true;
				console.warn("[Spriter] Atlas frame lookup: GetObjectClass() returned null.");
			}
			return null;
		}

		const getAnimations = typeof objectClass.GetAnimations === "function"
			? objectClass.GetAnimations.bind(objectClass)
			: typeof objectClass.getAnimations === "function"
				? objectClass.getAnimations.bind(objectClass)
				: null;

		if (!getAnimations)
		{
			if (this._atlasDebug && !this._atlasDebug.loggedFrameLookupIssue)
			{
				this._atlasDebug.loggedFrameLookupIssue = true;
				console.warn("[Spriter] Atlas frame lookup: object class has no GetAnimations/getAnimations method.");
			}
			return null;
		}

		const animations = getAnimations();
		if (!Array.isArray(animations) || !animations.length)
		{
			if (this._atlasDebug && !this._atlasDebug.loggedFrameLookupIssue)
			{
				this._atlasDebug.loggedFrameLookupIssue = true;
				console.warn("[Spriter] Atlas frame lookup: object class has no animations.");
			}
			return null;
		}

		const firstAnimation = animations[0];
		if (!firstAnimation)
		{
			return null;
		}

		const getFrames = typeof firstAnimation.GetFrames === "function"
			? firstAnimation.GetFrames.bind(firstAnimation)
			: typeof firstAnimation.getFrames === "function"
				? firstAnimation.getFrames.bind(firstAnimation)
				: null;

		if (!getFrames)
		{
			if (this._atlasDebug && !this._atlasDebug.loggedFrameLookupIssue)
			{
				this._atlasDebug.loggedFrameLookupIssue = true;
				console.warn("[Spriter] Atlas frame lookup: first animation has no GetFrames/getFrames method.");
			}
			return null;
		}

		const frames = getFrames();
		if (!Array.isArray(frames) || atlasIndex >= frames.length)
		{
			if (this._atlasDebug && !this._atlasDebug.loggedFrameLookupIssue)
			{
				this._atlasDebug.loggedFrameLookupIssue = true;
				const count = Array.isArray(frames) ? frames.length : 0;
				console.warn(`[Spriter] Atlas frame lookup: frame index ${atlasIndex} out of range (frames=${count}).`);
			}
			return null;
		}

		const frame = frames[atlasIndex] || null;
		if (frame && this._atlasFrameCache)
		{
			this._atlasFrameCache.set(atlasIndex, frame);
		}

		return frame;
	}

	_requestAtlasTextureLoad(atlasIndex, imageInfo, renderer)
	{
		if (!Number.isInteger(atlasIndex) || atlasIndex < 0 || !imageInfo || !renderer)
		{
			return;
		}

		let entry = this._atlasTextureLoadState.get(atlasIndex);
		if (!entry)
		{
			entry = { promise: null, error: null };
			this._atlasTextureLoadState.set(atlasIndex, entry);
		}

		if (entry.promise || entry.error)
		{
			return;
		}

		const loadAsset = imageInfo.LoadAsset || imageInfo.loadAsset || null;
		if (typeof loadAsset === "function")
		{
			loadAsset.call(imageInfo, this.runtime);
		}

		const loadStaticTexture = imageInfo.LoadStaticTexture || imageInfo.loadStaticTexture || null;
		if (typeof loadStaticTexture !== "function")
		{
			return;
		}

		let options = undefined;
		const getSampling = this.runtime && typeof this.runtime.GetSampling === "function"
			? this.runtime.GetSampling.bind(this.runtime)
			: null;
		if (getSampling)
		{
			const sampling = getSampling();
			if (sampling != null)
			{
				options = { sampling };
			}
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
						console.error(`[Spriter] Failed atlas texture upload for frame ${atlasIndex}: ${entry.error}`, error);
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
			console.error(`[Spriter] Failed requesting atlas texture upload for frame ${atlasIndex}: ${entry.error}`, error);
		}
	}

	_getDtSeconds()
	{
		const runtime = this.runtime;
		if (runtime && Number.isFinite(runtime.dt))
		{
			let dt = runtime.dt;
			if (this.ignoreGlobalTimeScale)
			{
				const getTimeScale = typeof runtime.GetTimeScale === "function"
					? runtime.GetTimeScale.bind(runtime)
					: typeof runtime.getTimeScale === "function"
						? runtime.getTimeScale.bind(runtime)
						: null;
				if (getTimeScale)
				{
					const timeScale = toFiniteNumber(getTimeScale(), 1);
					if (timeScale > 0)
					{
						dt /= timeScale;
					}
				}
			}
			return dt;
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
		// Avoid giant steps when the tab is backgrounded.
		return dt > 0 && dt < 0.5 ? dt : 0;
	}

	_advanceTime(dtSeconds)
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			return false;
		}

		const speed = Number.isFinite(this.playbackSpeed) ? this.playbackSpeed : 1;
		if (speed === 0)
		{
			return false;
		}

		const previousTime = this.localTimeMs;
		const deltaMs = dtSeconds * 1000 * speed;
		let nextTime = previousTime + deltaMs;

		const isLooping = this._isAnimationLooping(this.animation);
		let finished = false;

		if (this._playToTimeMs >= 0)
		{
			const targetTime = this._playToTimeMs;
			if (this._didCrossPlayToTarget(previousTime, nextTime, targetTime, lengthMs, isLooping, speed))
			{
				nextTime = targetTime;
				this._playToTimeMs = -1;
				this.playing = false;
				finished = true;
			}
		}

		if (!finished)
		{
			if (isLooping)
			{
				if (speed >= 0)
				{
					if (previousTime < lengthMs && nextTime >= lengthMs)
					{
						finished = true;
					}
				}
				else if (previousTime > 0 && nextTime <= 0)
				{
					finished = true;
				}
			}
			else
			{
				if (speed >= 0 && nextTime >= lengthMs)
				{
					if (previousTime < lengthMs)
					{
						finished = true;
					}

					nextTime = lengthMs;
					this.playing = false;
					this._playToTimeMs = -1;
				}
				else if (speed < 0 && nextTime <= 0)
				{
					if (previousTime > 0)
					{
						finished = true;
					}

					nextTime = 0;
					this.playing = false;
					this._playToTimeMs = -1;
				}
			}
		}

		this.localTimeMs = this._normaliseSampleTime(nextTime, lengthMs, isLooping);
		return finished;
	}

	_resetAutoBlendState()
	{
		this._autoBlendActive = false;
		this._autoBlendStartFrom = 0;
		this._autoBlendDurationMs = 0;
		this._autoBlendElapsedMs = 0;
		this._autoBlendPrimaryPoseTimeMs = 0;
		this._autoBlendTargetAnimationIndex = -1;
	}

	_startAutoBlend(nextAnimation, nextAnimationIndex, startFrom, blendDurationMs)
	{
		const durationMs = Math.max(1, toFiniteNumber(blendDurationMs, 0));
		this.secondAnimation = nextAnimation;
		this.animBlend = 0;
		this._autoBlendActive = true;
		this._autoBlendStartFrom = startFrom === 3 ? 3 : 4;
		this._autoBlendDurationMs = durationMs;
		this._autoBlendElapsedMs = 0;
		this._autoBlendPrimaryPoseTimeMs = this.localTimeMs;
		this._autoBlendTargetAnimationIndex = toFiniteNumber(nextAnimationIndex, -1);
	}

	_advanceAutoBlend(dtSeconds)
	{
		if (!this._autoBlendActive || !this.secondAnimation)
		{
			return;
		}

		const durationMs = toFiniteNumber(this._autoBlendDurationMs, 0);
		if (!(durationMs > 0))
		{
			this._completeAutoBlend();
			return;
		}

		const deltaMs = Math.max(0, toFiniteNumber(dtSeconds, 0) * 1000);
		this._autoBlendElapsedMs += deltaMs;
		this.animBlend = clamp01(this._autoBlendElapsedMs / durationMs);
		if (this.animBlend >= 1)
		{
			this._completeAutoBlend();
		}
	}

	_completeAutoBlend()
	{
		const nextAnimation = this.secondAnimation;
		if (!nextAnimation)
		{
			this._resetAutoBlendState();
			this.animBlend = 0;
			return;
		}

		const currentLengthMs = Math.max(0, toFiniteNumber(this.animationLengthMs, 0));
		const nextLengthMs = Math.max(0, toFiniteNumber(nextAnimation.length, 0));
		if (!(nextLengthMs > 0))
		{
			this.secondAnimation = null;
			this.animBlend = 0;
			this._resetAutoBlendState();
			return;
		}

		let nextTimeMs = 0;
		if (this._autoBlendStartFrom === 4 && currentLengthMs > 0)
		{
			const ratio = clamp01(this.localTimeMs / currentLengthMs);
			nextTimeMs = ratio * nextLengthMs;
		}

		const entityAnimations = this.entity && Array.isArray(this.entity.animation) ? this.entity.animation : [];
		const fallbackIndex = entityAnimations.indexOf(nextAnimation);
		const nextAnimationIndex = this._autoBlendTargetAnimationIndex >= 0
			? this._autoBlendTargetAnimationIndex
			: fallbackIndex;

		this.animationIndex = nextAnimationIndex >= 0 ? nextAnimationIndex : this.animationIndex;
		this.animation = nextAnimation;
		this.animationLengthMs = nextLengthMs;
		this.startingAnimationName = typeof nextAnimation.name === "string"
			? nextAnimation.name
			: this.startingAnimationName;
		this.localTimeMs = this._normaliseSampleTime(nextTimeMs, nextLengthMs, this._isAnimationLooping(nextAnimation));
		this._playToTimeMs = -1;

		this.secondAnimation = null;
		this.animBlend = 0;
		this._resetAutoBlendState();

		this._rebuildAnimationTimelineCache(nextAnimation);
		this._buildSoundLineCache();
		this._buildEventLineCache();
		this._applyAnimationBoundsToWorldInfo(nextAnimation);
		this._evaluatePose();
		this._refreshMetaState(this._currentAdjustedTimeMs);
		this._evaluateSoundLines(this._currentAdjustedTimeMs, true);
		this._evaluateEventLines(this._currentAdjustedTimeMs, true);
	}

	_normaliseLoopTime(timeMs, lengthMs)
	{
		const length = toFiniteNumber(lengthMs, 0);
		if (!(length > 0))
		{
			return 0;
		}

		let t = toFiniteNumber(timeMs, 0);
		while (t < 0)
		{
			t += length;
		}
		if (t !== length)
		{
			t %= length;
		}
		if (t < 0)
		{
			t += length;
		}

		return t;
	}

	_normaliseSampleTime(timeMs, lengthMs, isLooping)
	{
		if (!isLooping)
		{
			return clamp(toFiniteNumber(timeMs, 0), 0, toFiniteNumber(lengthMs, 0));
		}

		return this._normaliseLoopTime(timeMs, lengthMs);
	}

	_didCrossPlayToTarget(previousTime, nextTime, targetTime, lengthMs, isLooping, speed)
	{
		const target = toFiniteNumber(targetTime, 0);
		if (!Number.isFinite(target))
		{
			return false;
		}

		if (!isLooping)
		{
			if (speed >= 0)
			{
				return target > previousTime && target <= nextTime;
			}
			return target < previousTime && target >= nextTime;
		}

		const from = this._normaliseLoopTime(previousTime, lengthMs);
		const to = this._normaliseLoopTime(nextTime, lengthMs);
		const targetNorm = this._normaliseLoopTime(target, lengthMs);

		if (to === targetNorm)
		{
			return true;
		}

		if (from === targetNorm || from === to)
		{
			return false;
		}

		if (speed >= 0)
		{
			if (from < to)
			{
				return targetNorm > from && targetNorm < to;
			}
			return targetNorm > from || targetNorm < to;
		}

		if (to < from)
		{
			return targetNorm < from && targetNorm > to;
		}
		return targetNorm < from || targetNorm > to;
	}

	_triggerAnimationFinished()
	{
		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnAnyAnimFinished === "function")
		{
			this._trigger(cnds.OnAnyAnimFinished);
		}
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnAnimFinished === "function")
		{
			this._trigger(cnds.OnAnimFinished);
		}
	}

	_findAnimationByIdentifier(identifier)
	{
		const entity = this.entity;
		const animations = entity && Array.isArray(entity.animation) ? entity.animation : [];
		if (!animations.length)
		{
			return -1;
		}

		if (identifier == null || identifier === "")
		{
			return 0;
		}

		const asNumber = Number(identifier);
		if (Number.isInteger(asNumber))
		{
			for (let i = 0, len = animations.length; i < len; i++)
			{
				const animation = animations[i];
				if (animation && Number.isInteger(animation.id) && animation.id === asNumber)
				{
					return i;
				}
			}

			if (asNumber >= 0 && asNumber < animations.length)
			{
				return asNumber;
			}
		}

		const asText = toLowerCaseSafe(identifier);
		if (!asText)
		{
			return 0;
		}

		for (let i = 0, len = animations.length; i < len; i++)
		{
			const animation = animations[i];
			const name = animation && typeof animation.name === "string"
				? animation.name.trim().toLowerCase()
				: "";
			if (name && name === asText)
			{
				return i;
			}
		}

		return -1;
	}

	_rebuildAnimationTimelineCache(animation)
	{
		this._timelineById.clear();
		this._timelineNameById.clear();

		const entityNamePrefix = this.entity && this.entity.name ? `${this.entity.name}_` : "";
		const timelines = animation && Array.isArray(animation.timeline) ? animation.timeline : [];
		for (let i = 0, len = timelines.length; i < len; i++)
		{
			const timeline = timelines[i];
			const id = toFiniteNumber(timeline && timeline.id, i);
			this._timelineById.set(id, timeline);

			let timelineName = timeline && typeof timeline.name === "string" ? timeline.name : "";
			if (entityNamePrefix && timelineName.startsWith(entityNamePrefix))
			{
				timelineName = timelineName.slice(entityNamePrefix.length);
			}
			this._timelineNameById.set(id, timelineName);
		}
	}

	_setAnimation(animationIdentifier, startFrom = 0, blendDuration = 0)
	{
		if (!this.entity)
		{
			if (typeof animationIdentifier === "string" && animationIdentifier.trim())
			{
				this.startingAnimationName = animationIdentifier.trim();
			}
			return false;
		}

		const animationIndex = this._findAnimationByIdentifier(animationIdentifier);
		if (animationIndex < 0)
		{
			return false;
		}

		const animations = this.entity && Array.isArray(this.entity.animation) ? this.entity.animation : [];
		const nextAnimation = animations[animationIndex] || null;
		if (!nextAnimation)
		{
			return false;
		}

		const blendStartMode = Number(startFrom);
		const blendMs = toFiniteNumber(blendDuration, 0);
		const shouldAutoBlend = (blendStartMode === 3 || blendStartMode === 4) && blendMs > 0 && !!this.animation;
		if (shouldAutoBlend)
		{
			if (nextAnimation === this.animation && !this.secondAnimation)
			{
				this._resetAutoBlendState();
				this.animBlend = 0;
				return true;
			}

			if (this._autoBlendActive && this.secondAnimation === nextAnimation && this._autoBlendStartFrom === blendStartMode)
			{
				return true;
			}

			this._startAutoBlend(nextAnimation, animationIndex, blendStartMode, blendMs);
			this._playToTimeMs = -1;
			this.playing = true;
			this._evaluatePose();
			this._evaluateSoundLines(this._currentAdjustedTimeMs, true);
			return true;
		}

		const previousLength = toFiniteNumber(this.animationLengthMs, 0);
		const previousRatio = previousLength > 0 ? clamp01(this.localTimeMs / previousLength) : 0;
		const nextLength = Math.max(0, toFiniteNumber(nextAnimation.length, 0));

		let nextTimeMs = this.localTimeMs;
		switch (startFrom)
		{
			case 0: // play from start
			case 3: // blend to start (legacy; unsupported blend)
				nextTimeMs = this.playbackSpeed >= 0 ? 0 : nextLength;
				break;
			case 2: // play from current time ratio
			case 4: // blend at current time ratio (legacy; unsupported blend)
				nextTimeMs = previousRatio * nextLength;
				break;
			case 1: // play from current time
			default:
				nextTimeMs = this.localTimeMs;
				break;
		}

		this.animationIndex = animationIndex;
		this.animation = nextAnimation;
		this.animationLengthMs = nextLength;
		this.secondAnimation = null;
		this.animBlend = 0;
		this._resetAutoBlendState();
		this.startingAnimationName = typeof nextAnimation.name === "string" ? nextAnimation.name : this.startingAnimationName;
		this.localTimeMs = this._normaliseSampleTime(nextTimeMs, nextLength, this._isAnimationLooping(nextAnimation));
		this._playToTimeMs = -1;
		this.playing = true;

		this._rebuildAnimationTimelineCache(nextAnimation);
		this._buildSoundLineCache();
		this._buildEventLineCache();
		this._applyAnimationBoundsToWorldInfo(nextAnimation);
		this._evaluatePose();
		this._refreshMetaState(this._currentAdjustedTimeMs);
		this._evaluateSoundLines(this._currentAdjustedTimeMs, true);
		this._evaluateEventLines(this._currentAdjustedTimeMs, true);
		return true;
	}

	_setPlaybackSpeedRatio(newSpeed)
	{
		this.playbackSpeed = toFiniteNumber(newSpeed, 1);
	}

	_findEntityIndexByName(entityName)
	{
		const entities = this.projectData && Array.isArray(this.projectData.entity) ? this.projectData.entity : [];
		if (!entities.length)
		{
			return -1;
		}

		const query = toLowerCaseSafe(entityName);
		if (!query)
		{
			return this.entityIndex >= 0 ? this.entityIndex : 0;
		}

		for (let i = 0, len = entities.length; i < len; i++)
		{
			const entity = entities[i];
			const name = entity && typeof entity.name === "string" ? entity.name : "";
			if (toLowerCaseSafe(name) === query)
			{
				return i;
			}
		}

		return -1;
	}

	_setEnt(entityName, animationName)
	{
		const requestedEntityName = toStringOrEmpty(entityName).trim();
		const requestedAnimationName = toStringOrEmpty(animationName).trim();

		if (!this.projectData || !this.isReady)
		{
			if (requestedEntityName)
			{
				this.startingEntityName = requestedEntityName;
			}
			if (requestedAnimationName)
			{
				this.startingAnimationName = requestedAnimationName;
			}
			return;
		}

		let nextEntityIndex = this.entityIndex;
		if (requestedEntityName)
		{
			const matchedEntityIndex = this._findEntityIndexByName(requestedEntityName);
			if (matchedEntityIndex < 0)
			{
				this.startingEntityName = requestedEntityName;
				return;
			}

			nextEntityIndex = matchedEntityIndex;
		}

		const entities = Array.isArray(this.projectData.entity) ? this.projectData.entity : [];
		const nextEntity = entities[nextEntityIndex] || null;
		if (!nextEntity)
		{
			return;
		}

		const entityChanged = nextEntityIndex !== this.entityIndex;
		if (entityChanged)
		{
			this.entityIndex = nextEntityIndex;
			this.entity = nextEntity;
			this.startingEntityName = typeof nextEntity.name === "string" ? nextEntity.name : this.startingEntityName;
			this._buildVarDefLookup(nextEntity);
			this._buildObjectInfoLookup(nextEntity);
			this._buildCharacterMapLookup(nextEntity);
			this._rebuildResolvedCharacterMapLookup();
			this._buildObjectArray();
			this._refreshAssociatedFrameLookups();
		}

		let targetAnimationName = requestedAnimationName;
		if (!targetAnimationName && this.animation && typeof this.animation.name === "string")
		{
			targetAnimationName = this.animation.name;
		}

		if (entityChanged || targetAnimationName)
		{
			const didSet = this._setAnimation(targetAnimationName || "", 1, 0);
			if (!didSet)
			{
				this._setAnimation("", 0, 0);
			}
		}
	}

	_parseFlipValue(value)
	{
		if (typeof value === "boolean")
		{
			return value;
		}

		if (typeof value === "number")
		{
			return value !== 0;
		}

		if (typeof value === "string")
		{
			const lower = value.trim().toLowerCase();
			if (!lower)
			{
				return false;
			}

			if (lower.includes("don't") || lower.includes("do not") || lower === "false")
			{
				return false;
			}

			if (lower.includes("flip") || lower.includes("mirror") || lower === "true")
			{
				return true;
			}

			const numeric = Number(lower);
			if (Number.isFinite(numeric))
			{
				return numeric !== 0;
			}
		}

		return false;
	}

	_setObjectScaleRatio(newScale, xFlip, yFlip)
	{
		const scale = Math.abs(toFiniteNumber(newScale, this._globalScaleRatio));
		if (Number.isFinite(scale) && scale !== 0)
		{
			this._globalScaleRatio = scale;
		}

		this._xFlip = this._parseFlipValue(xFlip);
		this._yFlip = this._parseFlipValue(yFlip);
		this._applyAnimationBoundsToWorldInfo(this.animation);
	}

	_setObjectXFlip(xFlip)
	{
		this._xFlip = this._parseFlipValue(xFlip);
		this._applyAnimationBoundsToWorldInfo(this.animation);
	}

	_setObjectYFlip(yFlip)
	{
		this._yFlip = this._parseFlipValue(yFlip);
		this._applyAnimationBoundsToWorldInfo(this.animation);
	}

	_setIgnoreGlobalTimeScale(ignore)
	{
		if (typeof ignore === "string")
		{
			const lower = ignore.trim().toLowerCase();
			if (!lower || lower.includes("don't") || lower.includes("do not"))
			{
				this.ignoreGlobalTimeScale = false;
				return;
			}

			if (lower.includes("ignore"))
			{
				this.ignoreGlobalTimeScale = true;
				return;
			}
		}

		this.ignoreGlobalTimeScale = Number(ignore) !== 0;
	}

	_stopResumeSettingLayer(resume)
	{
		this.setLayersForSprites = Number(resume) !== 0;
	}

	_stopResumeSettingVisibilityForObjects(resume)
	{
		this.setVisibilityForObjects = Number(resume) !== 0;
	}

	_stopResumeSettingCollisionsForObjects(resume)
	{
		this.setCollisionsForObjects = Number(resume) !== 0;
	}

	_setVisible(visible)
	{
		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo || typeof worldInfo.SetVisible !== "function")
		{
			return;
		}

		worldInfo.SetVisible(Number(visible) !== 0);
		if (typeof worldInfo.SetBboxChanged === "function")
		{
			worldInfo.SetBboxChanged();
		}
	}

	_setOpacity(opacityPercent)
	{
		const percent = clamp(toFiniteNumber(opacityPercent, this.startingOpacity), 0, 100);
		this.startingOpacity = percent;

		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo || typeof worldInfo.SetOpacity !== "function")
		{
			return;
		}

		worldInfo.SetOpacity(percent / 100);
		if (typeof worldInfo.SetBboxChanged === "function")
		{
			worldInfo.SetBboxChanged();
		}
	}

	_setSecondAnim(animName)
	{
		this._resetAutoBlendState();
		const index = this._findAnimationByIdentifier(animName);
		const animations = this.entity && Array.isArray(this.entity.animation) ? this.entity.animation : [];
		const candidate = index >= 0 ? (animations[index] || null) : null;
		if (!candidate || index === this.animationIndex)
		{
			this.secondAnimation = null;
			return;
		}

		this.secondAnimation = candidate;
	}

	_stopSecondAnim()
	{
		this._resetAutoBlendState();
		this.secondAnimation = null;
		this.animBlend = 0;
	}

	_setAnimBlendRatio(newBlend)
	{
		this.animBlend = clamp01(toFiniteNumber(newBlend, 0));
	}

	_areInstancesEquivalent(a, b)
	{
		if (!a || !b)
		{
			return false;
		}

		if (a === b)
		{
			return true;
		}

		const aUid = this._getInstanceUidMaybe(a);
		const bUid = this._getInstanceUidMaybe(b);
		if (Number.isFinite(aUid) && Number.isFinite(bUid) && aUid === bUid)
		{
			return true;
		}

		const ai = a._inst || null;
		const bi = b._inst || null;
		if ((ai && (ai === b || ai === bi)) || (bi && (bi === a || bi === ai)))
		{
			return true;
		}

		const aSdk = typeof this._getSdkInstanceOf === "function" ? this._getSdkInstanceOf(a) : null;
		const bSdk = typeof this._getSdkInstanceOf === "function" ? this._getSdkInstanceOf(b) : null;
		if (aSdk && (aSdk === b || aSdk === bi || (bSdk && aSdk === bSdk)))
		{
			return true;
		}
		if (bSdk && (bSdk === a || bSdk === ai))
		{
			return true;
		}

		return false;
	}

	_getInstanceUidMaybe(inst)
	{
		if (!inst)
		{
			return NaN;
		}

		const methods = ["GetUID", "getUID", "getUid"];
		for (const fnName of methods)
		{
			if (typeof inst[fnName] === "function")
			{
				const uid = Number(inst[fnName]());
				if (Number.isFinite(uid))
				{
					return uid;
				}
			}
		}

		const props = ["uid", "_uid"];
		for (const propName of props)
		{
			const uid = Number(inst[propName]);
			if (Number.isFinite(uid))
			{
				return uid;
			}
		}

		if (inst._inst && inst._inst !== inst)
		{
			return this._getInstanceUidMaybe(inst._inst);
		}

		return NaN;
	}

	_findSpriterObject(c2Object)
	{
		this.lastFoundObject = "";
		if (!c2Object)
		{
			return;
		}

		const candidateType = (c2Object && typeof c2Object.GetObjectClass === "function")
			? c2Object.GetObjectClass()
			: (c2Object && typeof c2Object.getObjectClass === "function")
				? c2Object.getObjectClass()
				: (c2Object && c2Object.objectType)
					? c2Object.objectType
					: (c2Object && c2Object.type)
						? c2Object.type
						: c2Object;

		let picked = null;
		if (typeof this._resolveC2Instances === "function")
		{
			const instances = this._resolveC2Instances(c2Object);
			picked = Array.isArray(instances) && instances.length ? instances[0] : null;
		}
		if (!picked && typeof c2Object.GetFirstPicked === "function")
		{
			picked = c2Object.GetFirstPicked();
		}
		if (!picked && typeof c2Object.getFirstPicked === "function")
		{
			picked = c2Object.getFirstPicked();
		}
		if (!picked)
		{
			let typeMatchName = "";
			for (const [name, entry] of this._c2ObjectMap)
			{
				if (!entry || !entry.type || entry.type !== candidateType)
				{
					continue;
				}

				if (typeMatchName)
				{
					typeMatchName = "";
					break;
				}

				typeMatchName = name;
			}

			this.lastFoundObject = typeMatchName;
			return;
		}

		for (const [name, entry] of this._c2ObjectMap)
		{
			const mapped = entry && entry.inst ? entry.inst : null;
			if (this._areInstancesEquivalent(mapped, picked))
			{
				this.lastFoundObject = name;
				return;
			}
		}

		let fallbackName = "";
		for (const [name, entry] of this._c2ObjectMap)
		{
			if (!entry || !entry.type || entry.type !== candidateType)
			{
				continue;
			}

			if (fallbackName)
			{
				fallbackName = "";
				break;
			}

			fallbackName = name;
		}
		this.lastFoundObject = fallbackName;
	}

	_setAnimationLoop(loopOn)
	{
		const shouldLoop = Number(loopOn) !== 0;
		if (!this.animation || this.animationIndex < 0)
		{
			this._pendingLoopOverride = shouldLoop;
			return;
		}

		const key = `${this.entityIndex}:${this.animationIndex}`;
		this._loopOverrideByAnimationIndex.set(key, shouldLoop);
	}

	_setAnimationTime(units, timeValue)
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			return;
		}

		let targetMs = toFiniteNumber(timeValue, 0);
		if (Number(units) === 1)
		{
			targetMs *= lengthMs;
		}

		this.localTimeMs = this._normaliseSampleTime(targetMs, lengthMs, this._isAnimationLooping(this.animation));
		this._playToTimeMs = -1;
		this._evaluatePose();
		this._evaluateSoundLines(this._currentAdjustedTimeMs, true);
	}

	_pauseAnimation()
	{
		this.playing = false;
	}

	_resumeAnimation()
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			this.playing = true;
			return;
		}

		if (this.playbackSpeed >= 0 && this.localTimeMs === lengthMs)
		{
			this.localTimeMs = 0;
		}
		else if (this.playbackSpeed < 0 && this.localTimeMs === 0)
		{
			this.localTimeMs = lengthMs;
		}

		this.playing = true;
	}

	_resolvePlayToTarget(units, targetValue)
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			return NaN;
		}

		const unitMode = Number(units);
		let targetMs = NaN;
		if (unitMode === 0)
		{
			const animation = this.animation;
			const mainline = animation && animation.mainline;
			const keys = mainline && Array.isArray(mainline.key) ? mainline.key : [];
			const keyIndex = Math.trunc(toFiniteNumber(targetValue, 0));
			const key = keyIndex >= 0 ? keys[keyIndex] : null;
			targetMs = toFiniteNumber(key && key.time, NaN);
		}
		else if (unitMode === 2)
		{
			targetMs = toFiniteNumber(targetValue, 0) * lengthMs;
		}
		else
		{
			targetMs = toFiniteNumber(targetValue, NaN);
		}

		if (!Number.isFinite(targetMs))
		{
			return NaN;
		}

		return this._normaliseSampleTime(targetMs, lengthMs, this._isAnimationLooping(this.animation));
	}

	_playAnimTo(units, targetValue)
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			return;
		}

		const targetMs = this._resolvePlayToTarget(units, targetValue);
		if (!Number.isFinite(targetMs))
		{
			this._playToTimeMs = -1;
			return;
		}

		if (targetMs === this.localTimeMs)
		{
			this._playToTimeMs = -1;
			return;
		}

		this._playToTimeMs = targetMs;

		let direction = 1;
		if (this._isAnimationLooping(this.animation))
		{
			let forwardDistance = 0;
			let backwardDistance = 0;
			if (targetMs > this.localTimeMs)
			{
				forwardDistance = targetMs - this.localTimeMs;
				backwardDistance = (lengthMs - targetMs) + this.localTimeMs;
			}
			else
			{
				forwardDistance = targetMs + (lengthMs - this.localTimeMs);
				backwardDistance = this.localTimeMs - targetMs;
			}

			if (backwardDistance < forwardDistance)
			{
				direction = -1;
			}
		}
		else if (targetMs < this.localTimeMs)
		{
			direction = -1;
		}

		this.playbackSpeed = Math.abs(toFiniteNumber(this.playbackSpeed, 1)) * direction;
		this.playing = true;
	}

	_getCurrentTimeRatio()
	{
		const lengthMs = this.animationLengthMs;
		if (!Number.isFinite(lengthMs) || lengthMs <= 0)
		{
			return 0;
		}

		return clamp01(this.localTimeMs / lengthMs);
	}

	_getPlayToTimeLeftMs()
	{
		const playTo = this._playToTimeMs;
		const lengthMs = this.animationLengthMs;
		if (!(playTo >= 0) || !(lengthMs > 0))
		{
			return 0;
		}

		const isLooping = this._isAnimationLooping(this.animation);
		if (isLooping)
		{
			if (this.playbackSpeed >= 0)
			{
				if (playTo > this.localTimeMs)
				{
					return playTo - this.localTimeMs;
				}
				return playTo + (lengthMs - this.localTimeMs);
			}

			if (playTo > this.localTimeMs)
			{
				return (lengthMs - playTo) + this.localTimeMs;
			}
			return this.localTimeMs - playTo;
		}

		return Math.abs(playTo - this.localTimeMs);
	}

	_isAnimationLooping(animation)
	{
		if (!animation || typeof animation !== "object")
		{
			return true;
		}

		const key = `${this.entityIndex}:${this.animationIndex}`;
		if (this._loopOverrideByAnimationIndex.has(key))
		{
			return !!this._loopOverrideByAnimationIndex.get(key);
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

		// Spriter defaults to looping when the attribute is omitted.
		return true;
	}

	_evaluatePose()
	{
		const animation = this.animation;
		const projectData = this.projectData;
		if (!animation || !projectData)
		{
			this._currentAdjustedTimeMs = toFiniteNumber(this.localTimeMs, 0);
			this._currentMainlineKeyIndex = 0;
			this._poseObjectStates.length = 0;
			this._poseBoneStates.length = 0;
			return;
		}

		const useFrozenPrimaryPose = this._autoBlendActive && this._autoBlendStartFrom === 3;
		const primarySampleTimeMs = useFrozenPrimaryPose ? this._autoBlendPrimaryPoseTimeMs : this.localTimeMs;
		const primaryPose = this._evaluatePoseForCurrentAnimation(primarySampleTimeMs);
		this._currentMainlineKeyIndex = primaryPose.mainKeyIndex;
		this._currentAdjustedTimeMs = primaryPose.adjustedTimeMs;

		const blend = clamp01(toFiniteNumber(this.animBlend, 0));
		const secondAnimation = this.secondAnimation;
		if (blend > 0 && secondAnimation && secondAnimation !== animation)
		{
			const savedAnimation = this.animation;
			const savedAnimationIndex = this.animationIndex;
			const savedAnimationLengthMs = this.animationLengthMs;
			const savedTimelineEntries = Array.from(this._timelineById.entries());
			const savedTimelineNameEntries = Array.from(this._timelineNameById.entries());

			let secondaryPose = null;
			try
			{
				const secondLengthMs = Math.max(0, toFiniteNumber(secondAnimation.length, 0));
				const entityAnimations = this.entity && Array.isArray(this.entity.animation) ? this.entity.animation : [];
				const secondIndex = entityAnimations.indexOf(secondAnimation);
				let secondSampleTimeMs = 0;
				if (secondLengthMs > 0)
				{
					if (this._autoBlendActive && this._autoBlendStartFrom === 3)
					{
						secondSampleTimeMs = 0;
					}
					else
					{
						const timeRatio = savedAnimationLengthMs > 0
							? clamp01(this.localTimeMs / savedAnimationLengthMs)
							: 0;
						secondSampleTimeMs = this._normaliseSampleTime(
							timeRatio * secondLengthMs,
							secondLengthMs,
							this._isAnimationLooping(secondAnimation)
						);
					}
				}

				this.animation = secondAnimation;
				this.animationIndex = secondIndex >= 0 ? secondIndex : savedAnimationIndex;
				this.animationLengthMs = secondLengthMs;
				this._rebuildAnimationTimelineCache(secondAnimation);
				secondaryPose = this._evaluatePoseForCurrentAnimation(secondSampleTimeMs);
			}
			finally
			{
				this.animation = savedAnimation;
				this.animationIndex = savedAnimationIndex;
				this.animationLengthMs = savedAnimationLengthMs;
				this._timelineById.clear();
				this._timelineNameById.clear();
				for (const [id, timeline] of savedTimelineEntries)
				{
					this._timelineById.set(id, timeline);
				}
				for (const [id, timelineName] of savedTimelineNameEntries)
				{
					this._timelineNameById.set(id, timelineName);
				}
			}

			if (secondaryPose)
			{
				this._blendPoseInPlace(primaryPose, secondaryPose, blend);
			}
		}

		this._poseBoneStates.length = 0;
		this._poseBoneStates.push(...primaryPose.bones);
		this._poseObjectStates.length = 0;
		this._poseObjectStates.push(...primaryPose.objects);
	}

	_evaluatePoseForCurrentAnimation(timeMs)
	{
		const animation = this.animation;
		const fallbackTime = toFiniteNumber(timeMs, 0);
		const emptyPose = {
			mainKeyIndex: 0,
			adjustedTimeMs: fallbackTime,
			bones: [],
			objects: []
		};

		const mainline = animation && animation.mainline;
		const keys = mainline && Array.isArray(mainline.key) ? mainline.key : [];
		if (!keys.length)
		{
			return emptyPose;
		}

		const sampleTimeMs = this._normaliseSampleTime(fallbackTime, this.animationLengthMs, this._isAnimationLooping(animation));
		const mainKeyIndex = this._findKeyIndexForTime(keys, sampleTimeMs);
		const mainKey = keys[mainKeyIndex];
		if (!mainKey)
		{
			return emptyPose;
		}

		const poseTimeMs = this._getMainlineAdjustedTime(keys, mainKeyIndex, sampleTimeMs);
		const boneRefs = Array.isArray(mainKey.bone_ref) ? mainKey.bone_ref : [];
		const objectRefs = Array.isArray(mainKey.object_ref) ? mainKey.object_ref : [];

		const boneRefsById = new Map();
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

		const boneWorldById = new Map();
		for (const boneRef of boneRefs)
		{
			this._resolveBoneTransform(boneRef, poseTimeMs, boneRefsById, boneWorldById);
		}
		this._applyBoneIkOverrides(boneRefs, boneRefsById, boneWorldById, poseTimeMs);

		const bones = [];
		for (const boneRef of boneRefs)
		{
			if (!boneRef)
			{
				continue;
			}

			const id = toFiniteNumber(boneRef.id, NaN);
			const world = boneWorldById.get(id);
			if (!world)
			{
				continue;
			}

			bones.push({
				id,
				parentId: toFiniteNumber(boneRef.parent, NaN),
				timelineName: this._timelineNameById.get(toFiniteNumber(boneRef.timeline, NaN)) || "",
				x: toFiniteNumber(world.x, 0),
				y: toFiniteNumber(world.y, 0),
				angle: toFiniteNumber(world.angle, 0),
				scaleX: toFiniteNumber(world.scaleX, 1),
				scaleY: toFiniteNumber(world.scaleY, 1),
				alpha: toFiniteNumber(world.alpha, 1)
			});
		}

		const objects = [];
		for (const objectRef of objectRefs)
		{
			const state = this._evaluateObjectRef(objectRef, poseTimeMs, boneRefsById, boneWorldById);
			if (state)
			{
				objects.push(state);
			}
		}
		objects.sort((a, b) => a.zIndex - b.zIndex);

		return {
			mainKeyIndex,
			adjustedTimeMs: poseTimeMs,
			bones,
			objects
		};
	}

	_blendPoseInPlace(primaryPose, secondaryPose, blend)
	{
		const t = clamp01(toFiniteNumber(blend, 0));
		if (t <= 0)
		{
			return;
		}

		const secondaryByObjectName = new Map();
		for (const state of secondaryPose.objects)
		{
			if (!state || !state.timelineName)
			{
				continue;
			}
			secondaryByObjectName.set(state.timelineName, state);
		}

		for (const primaryState of primaryPose.objects)
		{
			if (!primaryState || !primaryState.timelineName)
			{
				continue;
			}

			const secondaryState = secondaryByObjectName.get(primaryState.timelineName);
			if (!secondaryState)
			{
				continue;
			}

			primaryState.x = lerp(toFiniteNumber(primaryState.x, 0), toFiniteNumber(secondaryState.x, primaryState.x), t);
			primaryState.y = lerp(toFiniteNumber(primaryState.y, 0), toFiniteNumber(secondaryState.y, primaryState.y), t);
			primaryState.angle = lerpAngleRadiansShortest(primaryState.angle, secondaryState.angle, t);
			primaryState.scaleX = lerp(toFiniteNumber(primaryState.scaleX, 1), toFiniteNumber(secondaryState.scaleX, primaryState.scaleX), t);
			primaryState.scaleY = lerp(toFiniteNumber(primaryState.scaleY, 1), toFiniteNumber(secondaryState.scaleY, primaryState.scaleY), t);
			primaryState.alpha = lerp(toFiniteNumber(primaryState.alpha, 1), toFiniteNumber(secondaryState.alpha, primaryState.alpha), t);
			primaryState.pivotX = lerp(toFiniteNumber(primaryState.pivotX, 0), toFiniteNumber(secondaryState.pivotX, primaryState.pivotX), t);
			primaryState.pivotY = lerp(toFiniteNumber(primaryState.pivotY, 0), toFiniteNumber(secondaryState.pivotY, primaryState.pivotY), t);
			primaryState.width = lerp(toFiniteNumber(primaryState.width, 0), toFiniteNumber(secondaryState.width, primaryState.width), t);
			primaryState.height = lerp(toFiniteNumber(primaryState.height, 0), toFiniteNumber(secondaryState.height, primaryState.height), t);

			if (t > 0.5)
			{
				primaryState.folder = secondaryState.folder;
				primaryState.file = secondaryState.file;
				primaryState.name = secondaryState.name;
				primaryState.atlasIndex = secondaryState.atlasIndex;
				primaryState.atlasW = secondaryState.atlasW;
				primaryState.atlasH = secondaryState.atlasH;
				primaryState.atlasX = secondaryState.atlasX;
				primaryState.atlasY = secondaryState.atlasY;
				primaryState.atlasXOff = secondaryState.atlasXOff;
				primaryState.atlasYOff = secondaryState.atlasYOff;
				primaryState.atlasRotated = secondaryState.atlasRotated;
			}
		}

		const secondaryBonesById = new Map();
		for (const state of secondaryPose.bones)
		{
			if (!state)
			{
				continue;
			}
			secondaryBonesById.set(toFiniteNumber(state.id, -1), state);
		}

		for (const primaryBone of primaryPose.bones)
		{
			if (!primaryBone)
			{
				continue;
			}
			const secondaryBone = secondaryBonesById.get(toFiniteNumber(primaryBone.id, -1));
			if (!secondaryBone)
			{
				continue;
			}

			primaryBone.x = lerp(toFiniteNumber(primaryBone.x, 0), toFiniteNumber(secondaryBone.x, primaryBone.x), t);
			primaryBone.y = lerp(toFiniteNumber(primaryBone.y, 0), toFiniteNumber(secondaryBone.y, primaryBone.y), t);
			primaryBone.alpha = lerp(toFiniteNumber(primaryBone.alpha, 1), toFiniteNumber(secondaryBone.alpha, primaryBone.alpha), t);
		}
	}

	_getSoundlinesForAnimation(animation)
	{
		if (!animation || typeof animation !== "object")
		{
			return [];
		}

		if (Array.isArray(animation.soundline))
		{
			return animation.soundline;
		}

		if (Array.isArray(animation.soundlines))
		{
			return animation.soundlines;
		}

		return [];
	}

	_extractSoundKeyObject(key)
	{
		if (!key || typeof key !== "object")
		{
			return null;
		}

		const direct = key.object;
		if (direct && typeof direct === "object" && !Array.isArray(direct))
		{
			return direct;
		}

		const objectList = Array.isArray(key.object) ? key.object : Array.isArray(key.objects) ? key.objects : null;
		if (objectList && objectList.length)
		{
			return objectList[0] || null;
		}

		return null;
	}

	_resolveSoundNameForFolderFile(folderId, fileId)
	{
		const fileInfo = this._getFileInfo(folderId, fileId);
		if (!fileInfo || typeof fileInfo.name !== "string")
		{
			return "";
		}

		return soundNameFromAssetPath(fileInfo.name);
	}

	_buildSoundLineCache()
	{
		this._soundLines.length = 0;
		this._soundStateByName.clear();
		this._triggeredSoundName = "";
		this._triggeredSoundTag = "";

		const soundlines = this._getSoundlinesForAnimation(this.animation);
		for (const soundline of soundlines)
		{
			if (!soundline || typeof soundline !== "object")
			{
				continue;
			}

			const lineName = typeof soundline.name === "string" ? soundline.name : "";
			const sourceKeys = Array.isArray(soundline.key) ? soundline.key : [];
			if (!sourceKeys.length)
			{
				continue;
			}

			const keys = [];
			for (const key of sourceKeys)
			{
				if (!key || typeof key !== "object")
				{
					continue;
				}

				const keyObj = this._extractSoundKeyObject(key);
				if (!keyObj)
				{
					continue;
				}

				const folder = toFiniteNumber(keyObj.folder, NaN);
				const file = toFiniteNumber(keyObj.file, NaN);
				let soundName = "";
				if (Number.isFinite(folder) && Number.isFinite(file))
				{
					soundName = this._resolveSoundNameForFolderFile(folder, file);
				}

				if (!soundName && typeof keyObj.name === "string")
				{
					soundName = soundNameFromAssetPath(keyObj.name);
				}

				keys.push({
					time: toFiniteNumber(key.time, 0),
					soundName,
					volume: toFiniteNumber(keyObj.volume, 1),
					panning: toFiniteNumber(keyObj.panning, 0),
					keyRef: key
				});
			}

			if (!keys.length)
			{
				continue;
			}

			keys.sort((a, b) => a.time - b.time);
			this._soundLines.push({
				name: lineName,
				keys,
				lastTimeMs: 0,
				hasTime: false
			});
			this._soundStateByName.set(lineName, {
				soundName: keys[0].soundName || "",
				volume: toFiniteNumber(keys[0].volume, 1),
				panning: toFiniteNumber(keys[0].panning, 0)
			});
		}
	}

	_testSoundTriggerTime(lastTime, time, triggerTime)
	{
		if (time === triggerTime)
		{
			return true;
		}
		else if (triggerTime === lastTime || lastTime === time)
		{
			return false;
		}
		else if (toFiniteNumber(this.playbackSpeed, 1) >= 0)
		{
			if (lastTime < time)
			{
				if (triggerTime > lastTime && triggerTime < time)
				{
					return true;
				}
			}
			else
			{
				if (triggerTime > lastTime || triggerTime < time)
				{
					return true;
				}
			}
		}
		else
		{
			if (lastTime > time)
			{
				if (triggerTime > time && triggerTime < lastTime)
				{
					return true;
				}
			}
			else
			{
				if (triggerTime > time || triggerTime < lastTime)
				{
					return true;
				}
			}
		}

		return false;
	}

	_getInterpolatedSoundState(soundLine, currentTimeMs)
	{
		const keys = soundLine && Array.isArray(soundLine.keys) ? soundLine.keys : [];
		if (!keys.length)
		{
			return null;
		}

		const clampedTime = toFiniteNumber(currentTimeMs, 0);
		const currentIndex = this._findKeyIndexForTime(keys, clampedTime);
		const currentKey = keys[currentIndex] || keys[0];
		if (!currentKey)
		{
			return null;
		}

		const nextIndex = (currentIndex + 1) % keys.length;
		const nextKey = keys[nextIndex] || currentKey;
		const isLooping = this._isAnimationLooping(this.animation);

		if (nextKey === currentKey || (nextIndex === 0 && !isLooping))
		{
			return {
				soundName: currentKey.soundName || "",
				volume: toFiniteNumber(currentKey.volume, 1),
				panning: toFiniteNumber(currentKey.panning, 0)
			};
		}

		const lengthMs = this.animationLengthMs;
		const startTime = toFiniteNumber(currentKey.time, 0);
		let endTime = toFiniteNumber(nextKey.time, startTime);
		let sampleTime = clampedTime;

		if (nextIndex === 0 && isLooping)
		{
			endTime += lengthMs;
			if (sampleTime < startTime)
			{
				sampleTime += lengthMs;
			}
		}

		const denom = endTime - startTime;
		const linearT = denom > 0 ? clamp01((sampleTime - startTime) / denom) : 0;
		const curvedT = evaluateCurveT(currentKey.keyRef, linearT);

		return {
			soundName: currentKey.soundName || "",
			volume: lerp(toFiniteNumber(currentKey.volume, 1), toFiniteNumber(nextKey.volume, toFiniteNumber(currentKey.volume, 1)), curvedT),
			panning: lerp(toFiniteNumber(currentKey.panning, 0), toFiniteNumber(nextKey.panning, toFiniteNumber(currentKey.panning, 0)), curvedT)
		};
	}

	_triggerSound(soundName, soundTag)
	{
		this._triggeredSoundName = soundName || "";
		this._triggeredSoundTag = soundTag || "";

		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnSoundTriggered === "function")
		{
			this._trigger(cnds.OnSoundTriggered);
		}
	}

	_triggerSoundVolumeChange(soundTag)
	{
		this._triggeredSoundName = "";
		this._triggeredSoundTag = soundTag || "";

		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnSoundVolumeChangeTriggered === "function")
		{
			this._trigger(cnds.OnSoundVolumeChangeTriggered);
		}
	}

	_triggerSoundPanningChange(soundTag)
	{
		this._triggeredSoundName = "";
		this._triggeredSoundTag = soundTag || "";

		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnSoundPanningChangeTriggered === "function")
		{
			this._trigger(cnds.OnSoundPanningChangeTriggered);
		}
	}

	_evaluateSoundLines(currentTimeMs, suppressTriggers = false)
	{
		const soundLines = this._soundLines;
		if (!Array.isArray(soundLines) || !soundLines.length)
		{
			return;
		}

		const now = toFiniteNumber(currentTimeMs, 0);

		for (const soundLine of soundLines)
		{
			const keys = Array.isArray(soundLine.keys) ? soundLine.keys : [];
			if (!keys.length)
			{
				continue;
			}

			const hasTime = !!soundLine.hasTime;
			const lastTime = hasTime ? toFiniteNumber(soundLine.lastTimeMs, now) : now;

			if (hasTime && !suppressTriggers && now !== lastTime)
			{
				for (const key of keys)
				{
					if (!key || !key.soundName)
					{
						continue;
					}

					if (this._testSoundTriggerTime(lastTime, now, toFiniteNumber(key.time, 0)))
					{
						this._triggerSound(key.soundName, soundLine.name);
					}
				}
			}

			const nextState = this._getInterpolatedSoundState(soundLine, now);
			if (nextState)
			{
				const stateName = soundLine.name || "";
				const priorState = this._soundStateByName.get(stateName);
				const hadPriorState = !!priorState;

				if (!suppressTriggers && hadPriorState && toFiniteNumber(priorState.volume, 0) !== toFiniteNumber(nextState.volume, 0))
				{
					this._triggerSoundVolumeChange(stateName);
				}

				if (!suppressTriggers && hadPriorState && toFiniteNumber(priorState.panning, 0) !== toFiniteNumber(nextState.panning, 0))
				{
					this._triggerSoundPanningChange(stateName);
				}

				this._soundStateByName.set(stateName, nextState);
			}

			soundLine.lastTimeMs = now;
			soundLine.hasTime = true;
		}
	}

	_getEventlinesForAnimation(animation)
	{
		if (!animation || typeof animation !== "object")
		{
			return [];
		}

		if (Array.isArray(animation.eventline))
		{
			return animation.eventline;
		}

		if (Array.isArray(animation.eventlines))
		{
			return animation.eventlines;
		}

		return [];
	}

	_buildEventLineCache()
	{
		this._eventLines.length = 0;
		this._triggeredEventName = "";

		const eventlines = this._getEventlinesForAnimation(this.animation);
		for (const eventline of eventlines)
		{
			if (!eventline || typeof eventline !== "object")
			{
				continue;
			}

			const lineName = typeof eventline.name === "string" ? eventline.name : "";
			const sourceKeys = Array.isArray(eventline.key) ? eventline.key : [];
			if (!sourceKeys.length)
			{
				continue;
			}

			const keys = [];
			for (const key of sourceKeys)
			{
				if (!key || typeof key !== "object")
				{
					continue;
				}

				keys.push({
					time: toFiniteNumber(key.time, 0)
				});
			}

			if (!keys.length)
			{
				continue;
			}

			keys.sort((a, b) => a.time - b.time);
			this._eventLines.push({
				name: lineName,
				keys,
				lastTimeMs: 0,
				hasTime: false
			});
		}
	}

	_triggerEvent(eventName)
	{
		this._triggeredEventName = eventName || "";
		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnEventTriggered === "function")
		{
			this._trigger(cnds.OnEventTriggered);
		}
	}

	_evaluateEventLines(currentTimeMs, suppressTriggers = false)
	{
		if (!Array.isArray(this._eventLines) || !this._eventLines.length)
		{
			return;
		}

		const now = toFiniteNumber(currentTimeMs, 0);
		for (const eventLine of this._eventLines)
		{
			const keys = Array.isArray(eventLine.keys) ? eventLine.keys : [];
			if (!keys.length)
			{
				continue;
			}

			const hasTime = !!eventLine.hasTime;
			const lastTime = hasTime ? toFiniteNumber(eventLine.lastTimeMs, now) : now;
			if (hasTime && !suppressTriggers && now !== lastTime)
			{
				for (const key of keys)
				{
					if (this._testSoundTriggerTime(lastTime, now, toFiniteNumber(key.time, 0)))
					{
						this._triggerEvent(eventLine.name);
					}
				}
			}

			eventLine.lastTimeMs = now;
			eventLine.hasTime = true;
		}
	}

	_getVarDefListFromSource(source)
	{
		if (!source || typeof source !== "object")
		{
			return [];
		}

		if (Array.isArray(source.var_defs))
		{
			return source.var_defs;
		}

		if (Array.isArray(source.varDefs))
		{
			return source.varDefs;
		}

		return [];
	}

	_normaliseVarDef(def, fallbackId)
	{
		if (!def || typeof def !== "object")
		{
			return null;
		}

		const id = toFiniteNumber(def.id, fallbackId);
		const name = typeof def.name === "string" ? def.name : "";
		const type = typeof def.type === "string" ? def.type.toLowerCase() : "float";
		let defaultValue = def.default;
		if (!Object.prototype.hasOwnProperty.call(def, "default"))
		{
			defaultValue = def.def;
		}
		if (!Object.prototype.hasOwnProperty.call(def, "default") && !Object.prototype.hasOwnProperty.call(def, "def"))
		{
			defaultValue = def.default_value;
		}
		if (!Object.prototype.hasOwnProperty.call(def, "default") && !Object.prototype.hasOwnProperty.call(def, "def") && !Object.prototype.hasOwnProperty.call(def, "default_value"))
		{
			defaultValue = 0;
		}

		return {
			id,
			name,
			type,
			defaultValue
		};
	}

	_registerVarDef(lookup, def)
	{
		if (!lookup || !def)
		{
			return;
		}

		if (!lookup.byId)
		{
			lookup.byId = new Map();
		}
		if (!lookup.byName)
		{
			lookup.byName = new Map();
		}

		if (Number.isFinite(def.id))
		{
			lookup.byId.set(def.id, def);
		}

		const key = toLowerCaseSafe(def.name);
		if (key)
		{
			lookup.byName.set(key, def);
		}
	}

	_buildTagDefLookup(projectData)
	{
		this._tagDefs.length = 0;
		const tagDefs = Array.isArray(projectData && projectData.tag_list)
			? projectData.tag_list
			: Array.isArray(projectData && projectData.tagList)
				? projectData.tagList
				: [];

		for (let i = 0; i < tagDefs.length; i++)
		{
			const tagDef = tagDefs[i];
			if (!tagDef || typeof tagDef !== "object")
			{
				continue;
			}

			const name = typeof tagDef.name === "string" ? tagDef.name : "";
			if (!name)
			{
				continue;
			}

			const id = toFiniteNumber(tagDef.id, i);
			this._tagDefs[id] = name;
		}
	}

	_buildVarDefLookup(entity)
	{
		this._varDefsById.clear();
		this._varDefsByName.clear();
		this._varDefsByScope.clear();

		const globalLookup = {
			byId: this._varDefsById,
			byName: this._varDefsByName
		};

		const globalDefs = this._getVarDefListFromSource(entity);
		for (let i = 0; i < globalDefs.length; i++)
		{
			const def = this._normaliseVarDef(globalDefs[i], i);
			this._registerVarDef(globalLookup, def);
		}

		this._varDefsByScope.set("", {
			byId: new Map(this._varDefsById),
			byName: new Map(this._varDefsByName)
		});

		const objInfoList = entity && Array.isArray(entity.obj_info)
			? entity.obj_info
			: entity && Array.isArray(entity.objInfo)
				? entity.objInfo
				: [];

		for (const objInfo of objInfoList)
		{
			if (!objInfo || typeof objInfo !== "object")
			{
				continue;
			}

			const defs = this._getVarDefListFromSource(objInfo);
			if (!defs.length)
			{
				continue;
			}

			const scopeLookup = {
				byId: new Map(this._varDefsById),
				byName: new Map(this._varDefsByName)
			};
			for (let i = 0; i < defs.length; i++)
			{
				const def = this._normaliseVarDef(defs[i], i);
				this._registerVarDef(scopeLookup, def);
			}

			const scopeNames = [
				typeof objInfo.name === "string" ? objInfo.name : "",
				typeof objInfo.realname === "string" ? objInfo.realname : ""
			];
			for (const scopeName of scopeNames)
			{
				const key = normaliseTimelineLookupName(scopeName, this.entity && this.entity.name);
				if (key)
				{
					this._varDefsByScope.set(key, scopeLookup);
				}
			}
		}
	}

	_buildObjectInfoLookup(entity)
	{
		this._objectInfoByName.clear();
		this._boneLengthByTimelineName.clear();

		const objInfoList = entity && Array.isArray(entity.obj_info)
			? entity.obj_info
			: entity && Array.isArray(entity.objInfo)
				? entity.objInfo
				: [];

		for (const objInfo of objInfoList)
		{
			if (!objInfo || typeof objInfo !== "object")
			{
				continue;
			}

			const frameSource = Array.isArray(objInfo.frames) ? objInfo.frames : [];
			const frameList = [];
			const frameBySource = new Map();
			for (let frameIndex = 0; frameIndex < frameSource.length; frameIndex++)
			{
				const frame = frameSource[frameIndex];
				if (!frame || typeof frame !== "object")
				{
					continue;
				}

				const folder = toFiniteNumber(frame.folder, NaN);
				const file = toFiniteNumber(frame.file, NaN);
				if (!Number.isFinite(folder) || !Number.isFinite(file))
				{
					continue;
				}

				const fileInfo = this._getFileInfo(folder, file);
				const key = makeFolderFileKey(folder, file);
				const fallbackPivotX = fileInfo ? toFiniteNumber(fileInfo.pivotX, 0) : 0;
				let fallbackPivotY = fileInfo ? toFiniteNumber(fileInfo.pivotY, 0) : 0;
				if (Object.prototype.hasOwnProperty.call(frame, "pivot_y") && !Object.prototype.hasOwnProperty.call(frame, "pivotY"))
				{
					fallbackPivotY = Number.isFinite(fallbackPivotY) ? 1 - fallbackPivotY : fallbackPivotY;
				}

				frameList.push({
					index: frameList.length,
					folder,
					file,
					key,
					pivotX: toFiniteNumber(frame.pivot_x, fallbackPivotX),
					pivotY: toFiniteNumber(frame.pivot_y, fallbackPivotY)
				});
				frameBySource.set(key, frameList.length - 1);
			}

			const entry = {
				frames: frameList,
				frameBySource
			};
			const boneLength = toFiniteNumber(objInfo.w, NaN);

			const candidateNames = [
				typeof objInfo.name === "string" ? objInfo.name : "",
				typeof objInfo.realname === "string" ? objInfo.realname : ""
			];
			for (const candidateName of candidateNames)
			{
				const key = normaliseTimelineLookupName(candidateName, this.entity && this.entity.name);
				if (key)
				{
					this._objectInfoByName.set(key, entry);
					if (Number.isFinite(boneLength))
					{
						this._boneLengthByTimelineName.set(key, boneLength);
					}
				}
			}
		}
	}

	_getCharacterMapsFromEntity(entity)
	{
		if (!entity || typeof entity !== "object")
		{
			return [];
		}

		if (Array.isArray(entity.character_map))
		{
			return entity.character_map;
		}

		if (Array.isArray(entity.char_map))
		{
			return entity.char_map;
		}

		return [];
	}

	_buildCharacterMapLookup(entity)
	{
		this._characterMapsByName.clear();

		const maps = this._getCharacterMapsFromEntity(entity);
		for (const mapEntry of maps)
		{
			if (!mapEntry || typeof mapEntry !== "object")
			{
				continue;
			}

			const mapName = typeof mapEntry.name === "string" ? mapEntry.name.trim() : "";
			if (!mapName)
			{
				continue;
			}

			const def = {
				name: mapName,
				perObject: new Map(),
				global: new Map()
			};
			const entries = Array.isArray(mapEntry.map) ? mapEntry.map : [];
			for (const entry of entries)
			{
				if (!entry || typeof entry !== "object")
				{
					continue;
				}

				const sourceFolder = toFiniteNumber(entry.folder, NaN);
				const sourceFile = toFiniteNumber(entry.file, NaN);
				if (!Number.isFinite(sourceFolder) || !Number.isFinite(sourceFile))
				{
					continue;
				}

				const sourceKey = makeFolderFileKey(sourceFolder, sourceFile);
				const targetFolder = toFiniteNumber(entry.target_folder, NaN);
				const targetFile = toFiniteNumber(entry.target_file, NaN);
				const hidden = !(Number.isFinite(targetFolder) && Number.isFinite(targetFile));
				const mapped = {
					hidden,
					folder: hidden ? sourceFolder : targetFolder,
					file: hidden ? sourceFile : targetFile
				};

				let appliedToObject = false;
				const targetKey = hidden ? "" : makeFolderFileKey(targetFolder, targetFile);
				for (const [objectName, objectInfo] of this._objectInfoByName)
				{
					if (!objectInfo || !objectInfo.frameBySource || !objectInfo.frameBySource.has(sourceKey))
					{
						continue;
					}

					if (!hidden && !objectInfo.frameBySource.has(targetKey))
					{
						continue;
					}

					let objectMap = def.perObject.get(objectName);
					if (!objectMap)
					{
						objectMap = new Map();
						def.perObject.set(objectName, objectMap);
					}
					objectMap.set(sourceKey, mapped);
					appliedToObject = true;
				}

				if (!appliedToObject)
				{
					def.global.set(sourceKey, mapped);
				}
			}

			this._characterMapsByName.set(toLowerCaseSafe(mapName), def);
		}
	}

	_rebuildResolvedCharacterMapLookup()
	{
		this._resolvedCharMapByObject.clear();
		this._resolvedCharMapGlobal.clear();

		for (const mapName of this._activeCharMapNames)
		{
			const def = this._characterMapsByName.get(toLowerCaseSafe(mapName));
			if (!def)
			{
				continue;
			}

			for (const [objectName, objectMap] of def.perObject)
			{
				let resolvedMap = this._resolvedCharMapByObject.get(objectName);
				if (!resolvedMap)
				{
					resolvedMap = new Map();
					this._resolvedCharMapByObject.set(objectName, resolvedMap);
				}

				for (const [sourceKey, mapped] of objectMap)
				{
					resolvedMap.set(sourceKey, mapped);
				}
			}

			for (const [sourceKey, mapped] of def.global)
			{
				this._resolvedCharMapGlobal.set(sourceKey, mapped);
			}
		}
	}

	_resolveCharacterMapForState(timelineName, folder, file)
	{
		if (!this._activeCharMapNames.length)
		{
			return null;
		}

		if (!Number.isFinite(folder) || !Number.isFinite(file))
		{
			return null;
		}

		const sourceKey = makeFolderFileKey(folder, file);
		const objectName = normaliseTimelineLookupName(timelineName, this.entity && this.entity.name);
		if (objectName)
		{
			const objectMap = this._resolvedCharMapByObject.get(objectName);
			if (objectMap && objectMap.has(sourceKey))
			{
				return objectMap.get(sourceKey);
			}
		}

		return this._resolvedCharMapGlobal.get(sourceKey) || null;
	}

	_getObjectInfoForTimelineName(timelineName)
	{
		const key = normaliseTimelineLookupName(timelineName, this.entity && this.entity.name);
		return key ? (this._objectInfoByName.get(key) || null) : null;
	}

	_getBoneLengthForTimelineName(timelineName)
	{
		const key = normaliseTimelineLookupName(timelineName, this.entity && this.entity.name);
		if (!key || !this._boneLengthByTimelineName)
		{
			return 0;
		}

		return toFiniteNumber(this._boneLengthByTimelineName.get(key), 0);
	}

	_refreshStateFileInfo(state)
	{
		const fileInfo = this._getFileInfo(toFiniteNumber(state.folder, NaN), toFiniteNumber(state.file, NaN));
		state.width = fileInfo ? toFiniteNumber(fileInfo.width, 0) : 0;
		state.height = fileInfo ? toFiniteNumber(fileInfo.height, 0) : 0;
		state.name = fileInfo && typeof fileInfo.name === "string" ? fileInfo.name : "";
		state.atlasIndex = fileInfo ? toFiniteNumber(fileInfo.atlasIndex, 0) : 0;
		state.atlasW = fileInfo ? toFiniteNumber(fileInfo.atlasW, 0) : 0;
		state.atlasH = fileInfo ? toFiniteNumber(fileInfo.atlasH, 0) : 0;
		state.atlasX = fileInfo ? toFiniteNumber(fileInfo.atlasX, 0) : 0;
		state.atlasY = fileInfo ? toFiniteNumber(fileInfo.atlasY, 0) : 0;
		state.atlasXOff = fileInfo ? toFiniteNumber(fileInfo.atlasXOff, 0) : 0;
		state.atlasYOff = fileInfo ? toFiniteNumber(fileInfo.atlasYOff, 0) : 0;
		state.atlasRotated = fileInfo ? !!fileInfo.atlasRotated : false;

		if (!Number.isFinite(toFiniteNumber(state.pivotX, NaN)))
		{
			state.pivotX = fileInfo ? toFiniteNumber(fileInfo.pivotX, 0) : 0;
		}
		if (!Number.isFinite(toFiniteNumber(state.pivotY, NaN)))
		{
			state.pivotY = fileInfo ? toFiniteNumber(fileInfo.pivotY, 0) : 0;
		}
	}

	_applyImageFrameOverrideToState(state, frameIndex)
	{
		const objectInfo = this._getObjectInfoForTimelineName(state.timelineName);
		if (!objectInfo || !Array.isArray(objectInfo.frames) || !objectInfo.frames.length)
		{
			return;
		}

		const frame = objectInfo.frames[clamp(Math.floor(toFiniteNumber(frameIndex, 0)), 0, objectInfo.frames.length - 1)];
		if (!frame)
		{
			return;
		}

		state.folder = frame.folder;
		state.file = frame.file;
		state.pivotX = frame.pivotX;
		state.pivotY = frame.pivotY;
		this._refreshStateFileInfo(state);
	}

	_lookupObjectOverrideEntries(timelineName)
	{
		if (!this._objectOverridesByName || this._objectOverridesByName.size === 0)
		{
			return null;
		}

		const key = normaliseTimelineLookupName(timelineName, this.entity && this.entity.name);
		return key ? (this._objectOverridesByName.get(key) || null) : null;
	}

	_worldToPoseLocal(worldX, worldY)
	{
		const worldInfo = this._getWorldInfoOf(this);
		const myX = toFiniteNumber(callFirstMethod(worldInfo, ["GetX", "getX"]), 0);
		const myY = toFiniteNumber(callFirstMethod(worldInfo, ["GetY", "getY"]), 0);
		const myAngle = toFiniteNumber(callFirstMethod(worldInfo, ["GetAngle", "getAngle"]), 0);
		const cosA = Math.cos(myAngle);
		const sinA = Math.sin(myAngle);
		const dx = toFiniteNumber(worldX, myX) - myX;
		const dy = toFiniteNumber(worldY, myY) - myY;
		const rotatedX = dx * cosA + dy * sinA;
		const rotatedY = -dx * sinA + dy * cosA;
		const globalScale = toFiniteNumber(this._globalScaleRatio, 1) || 1;
		const mirrorFactor = this._xFlip ? -1 : 1;
		const flipFactor = this._yFlip ? -1 : 1;
		return {
			x: rotatedX / (globalScale * mirrorFactor),
			y: rotatedY / (globalScale * flipFactor)
		};
	}

	_applyObjectPositionWorldOverride(state, overrideX, overrideY)
	{
		const worldState = this._getPoseStateWorldTransform(state);
		const targetX = overrideX != null ? toFiniteNumber(overrideX, worldState ? worldState.x : 0) : (worldState ? worldState.x : 0);
		const targetY = overrideY != null ? toFiniteNumber(overrideY, worldState ? worldState.y : 0) : (worldState ? worldState.y : 0);
		const local = this._worldToPoseLocal(targetX, targetY);
		state.x = local.x;
		state.y = local.y;
	}

	_applyObjectComponentOverrides(state)
	{
		const overrides = this._lookupObjectOverrideEntries(state.timelineName);
		if (!overrides)
		{
			return;
		}

		let hasXOverride = false;
		let hasYOverride = false;
		let overrideX = 0;
		let overrideY = 0;

		for (const [component, value] of overrides)
		{
			switch (component)
			{
				case OVERRIDE_COMPONENT.X:
					hasXOverride = true;
					overrideX = toFiniteNumber(value, 0);
					break;
				case OVERRIDE_COMPONENT.Y:
					hasYOverride = true;
					overrideY = toFiniteNumber(value, 0);
					break;
				default:
					break;
			}
		}

		if (hasXOverride || hasYOverride)
		{
			this._applyObjectPositionWorldOverride(state, hasXOverride ? overrideX : null, hasYOverride ? overrideY : null);
		}

		for (const [component, value] of overrides)
		{
			switch (component)
			{
				case OVERRIDE_COMPONENT.ANGLE:
				{
					const worldInfo = this._getWorldInfoOf(this);
					const objectAngle = degreesToRadians(toFiniteNumber(value, 0));
					const myAngle = toFiniteNumber(callFirstMethod(worldInfo, ["GetAngle", "getAngle"]), 0);
					const flipSign = (this._xFlip ? -1 : 1) * (this._yFlip ? -1 : 1);
					state.angle = flipSign < 0
						? (Math.PI * 2) - (objectAngle - myAngle)
						: objectAngle - myAngle;
					break;
				}
				case OVERRIDE_COMPONENT.SCALE_X:
					state.scaleX = toFiniteNumber(value, state.scaleX);
					break;
				case OVERRIDE_COMPONENT.SCALE_Y:
					state.scaleY = toFiniteNumber(value, state.scaleY);
					break;
				case OVERRIDE_COMPONENT.IMAGE:
					this._applyImageFrameOverrideToState(state, value);
					break;
				case OVERRIDE_COMPONENT.PIVOT_X:
					state.pivotX = toFiniteNumber(value, state.pivotX);
					break;
				case OVERRIDE_COMPONENT.PIVOT_Y:
					state.pivotY = toFiniteNumber(value, state.pivotY);
					break;
				default:
					break;
			}
		}
	}

	_getAnimationBounds(animation)
	{
		if (!animation || typeof animation !== "object")
		{
			return null;
		}

		const left = toFiniteNumber(animation.l, NaN);
		const right = toFiniteNumber(animation.r, NaN);
		const top = toFiniteNumber(animation.t, NaN);
		const bottom = toFiniteNumber(animation.b, NaN);
		if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom))
		{
			return null;
		}

		const width = right - left;
		const height = bottom - top;
		if (!(width > 0) || !(height > 0))
		{
			return null;
		}

		return {
			left,
			right,
			top,
			bottom,
			width,
			height
		};
	}

	_applyAnimationBoundsToWorldInfo(animation)
	{
		const worldInfo = this._getWorldInfoOf(this);
		const bounds = this._getAnimationBounds(animation);
		if (!worldInfo || !bounds)
		{
			return;
		}

		const scale = Math.abs(toFiniteNumber(this._globalScaleRatio, 1)) || 1;
		const width = bounds.width * scale;
		const height = bounds.height * scale;
		callFirstMethod(worldInfo, ["SetWidth", "setWidth"], width);
		callFirstMethod(worldInfo, ["SetHeight", "setHeight"], height);

		const originX = -((this._xFlip ? -bounds.right : bounds.left) / bounds.width);
		const originY = -((this._yFlip ? -bounds.bottom : bounds.top) / bounds.height);
		callFirstMethod(worldInfo, ["SetOriginX", "setOriginX"], originX);
		callFirstMethod(worldInfo, ["SetOriginY", "setOriginY"], originY);
		callFirstMethod(worldInfo, ["SetBboxChanged", "setBboxChanged"]);
	}

	_getViewportBoundsFromLayer(layer)
	{
		const viewport = callFirstMethod(layer, ["GetViewport", "getViewport"]);
		if (!viewport)
		{
			return null;
		}

		const left = toFiniteNumber(callFirstMethod(viewport, ["GetLeft", "getLeft"]), toFiniteNumber(viewport.left, NaN));
		const right = toFiniteNumber(callFirstMethod(viewport, ["GetRight", "getRight"]), toFiniteNumber(viewport.right, NaN));
		const top = toFiniteNumber(callFirstMethod(viewport, ["GetTop", "getTop"]), toFiniteNumber(viewport.top, NaN));
		const bottom = toFiniteNumber(callFirstMethod(viewport, ["GetBottom", "getBottom"]), toFiniteNumber(viewport.bottom, NaN));
		if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom))
		{
			return null;
		}

		return {
			left,
			right,
			top,
			bottom
		};
	}

	_isOutsideViewportBox()
	{
		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo)
		{
			return false;
		}

		const layer = callFirstMethod(worldInfo, ["GetLayer", "getLayer"]);
		if (!layer)
		{
			return false;
		}

		const bounds = this._getViewportBoundsFromLayer(layer);
		if (!bounds)
		{
			return false;
		}

		const x = toFiniteNumber(callFirstMethod(worldInfo, ["GetX", "getX"]), 0);
		const y = toFiniteNumber(callFirstMethod(worldInfo, ["GetY", "getY"]), 0);

		return (
			x < bounds.left - toFiniteNumber(this._autoPauseLeftBuffer, 0) ||
			x > bounds.right + toFiniteNumber(this._autoPauseRightBuffer, 0) ||
			y < bounds.top - toFiniteNumber(this._autoPauseTopBuffer, 0) ||
			y > bounds.bottom + toFiniteNumber(this._autoPauseBottomBuffer, 0)
		);
	}

	_setAutomaticPausing(mode, leftBuffer, rightBuffer, topBuffer, bottomBuffer)
	{
		this._autoPauseMode = clamp(toFiniteNumber(mode, AUTOMATIC_PAUSE_MODE.NEVER), AUTOMATIC_PAUSE_MODE.NEVER, AUTOMATIC_PAUSE_MODE.ALL_BUT_SOUND);
		this._autoPauseLeftBuffer = toFiniteNumber(leftBuffer, 0);
		this._autoPauseRightBuffer = toFiniteNumber(rightBuffer, 0);
		this._autoPauseTopBuffer = toFiniteNumber(topBuffer, 0);
		this._autoPauseBottomBuffer = toFiniteNumber(bottomBuffer, 0);
	}

	_appendCharMap(mapName)
	{
		const key = toLowerCaseSafe(mapName);
		if (!key)
		{
			return;
		}

		const mapDef = this._characterMapsByName.get(key);
		if (!mapDef)
		{
			return;
		}

		if (!this._activeCharMapNames.some((name) => toLowerCaseSafe(name) === key))
		{
			this._activeCharMapNames.push(mapDef.name);
			this._rebuildResolvedCharacterMapLookup();
		}
	}

	_removeCharMap(mapName)
	{
		const key = toLowerCaseSafe(mapName);
		if (!key)
		{
			return;
		}

		const index = this._activeCharMapNames.findIndex((name) => toLowerCaseSafe(name) === key);
		if (index >= 0)
		{
			this._activeCharMapNames.splice(index, 1);
			this._rebuildResolvedCharacterMapLookup();
		}
	}

	_removeAllCharMaps()
	{
		if (!this._activeCharMapNames.length)
		{
			return;
		}

		this._activeCharMapNames.length = 0;
		this._rebuildResolvedCharacterMapLookup();
	}

	_overrideObjectComponent(objectName, component, newValue)
	{
		const key = normaliseTimelineLookupName(objectName, this.entity && this.entity.name);
		if (!key)
		{
			return;
		}

		const componentIndex = toFiniteNumber(component, NaN);
		if (!Number.isFinite(componentIndex))
		{
			return;
		}

		let overrides = this._objectOverridesByName.get(key);
		if (!overrides)
		{
			overrides = new Map();
			this._objectOverridesByName.set(key, overrides);
		}
		overrides.set(componentIndex, newValue);
	}

	_overrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength)
	{
		const key = normaliseTimelineLookupName(parentBoneName, this.entity && this.entity.name);
		if (!key)
		{
			return;
		}

		this._boneIkOverridesByName.set(key, {
			childBone: normaliseTimelineLookupName(childBoneName, this.entity && this.entity.name),
			targetX: toFiniteNumber(targetX, 0),
			targetY: toFiniteNumber(targetY, 0),
			additionalLength: toFiniteNumber(additionalLength, 0)
		});
	}

	_setZElevation(zElevation)
	{
		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo)
		{
			return;
		}

		callFirstMethod(worldInfo, ["SetZElevation", "setZElevation"], toFiniteNumber(zElevation, 0));
		callFirstMethod(worldInfo, ["SetBboxChanged", "setBboxChanged"]);
	}

	_triggerOnURLLoaded()
	{
		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnURLLoaded === "function")
		{
			this._trigger(cnds.OnURLLoaded);
		}
	}

	_triggerOnURLFailed()
	{
		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnURLFailed === "function")
		{
			this._trigger(cnds.OnURLFailed);
		}
	}

	async _loadFromURL(url, crossOrigin, sconText)
	{
		try
		{
			let jsonText = typeof sconText === "string" ? sconText.trim() : "";
			if (!jsonText)
			{
				const targetUrl = toStringOrEmpty(url).trim();
				if (!targetUrl)
				{
					throw new Error("Spriter: loadFromURL requires a URL or SCON text.");
				}

				const response = await fetch(targetUrl, { mode: "cors" });
				if (!response.ok)
				{
					throw new Error(`Spriter: failed to fetch '${targetUrl}' (${response.status}).`);
				}

				jsonText = await response.text();
			}

			const projectData = JSON.parse(jsonText);
			this.projectData = projectData;
			this._projectDataPromise = null;
			this.loadError = null;
			this.loadErrorMessage = "";
			this.isReady = false;
			this._didTriggerReady = false;
			this._didTriggerLoadFailed = false;
			this._initPlaybackFromProject(projectData);
			this.isReady = true;
			this._triggerOnURLLoaded();
			this._triggerOnReady();
		}
		catch (error)
		{
			const message = error instanceof Error ? error.message : String(error);
			console.error("[Spriter] loadFromURL failed:", message, error);
			this._triggerOnURLFailed();
		}
	}

	_getTaglineKeys(meta)
	{
		const tagline = meta && typeof meta === "object" ? meta.tagline : null;
		if (!tagline)
		{
			return [];
		}

		if (Array.isArray(tagline.key))
		{
			return tagline.key;
		}
		if (Array.isArray(tagline.keys))
		{
			return tagline.keys;
		}

		return [];
	}

	_getVarlines(meta)
	{
		if (!meta || typeof meta !== "object")
		{
			return [];
		}

		if (Array.isArray(meta.varline))
		{
			return meta.varline;
		}
		if (Array.isArray(meta.varlines))
		{
			return meta.varlines;
		}

		return [];
	}

	_resolveTagNameFromEntry(tagEntry)
	{
		if (typeof tagEntry === "string")
		{
			return tagEntry;
		}
		if (!tagEntry || typeof tagEntry !== "object")
		{
			return "";
		}

		if (typeof tagEntry.name === "string")
		{
			return tagEntry.name;
		}

		const id = toFiniteNumber(tagEntry.t, NaN);
		if (Number.isFinite(id) && typeof this._tagDefs[id] === "string")
		{
			return this._tagDefs[id];
		}

		return "";
	}

	_evaluateTaglineAtTime(meta, timeMs, animationLengthMs, isLooping)
	{
		const keys = this._getTaglineKeys(meta);
		if (!keys.length)
		{
			return [];
		}

		const sorted = [...keys].sort((a, b) => toFiniteNumber(a && a.time, 0) - toFiniteNumber(b && b.time, 0));
		const currentTime = toFiniteNumber(timeMs, 0);
		let index = 0;
		if (currentTime < toFiniteNumber(sorted[0] && sorted[0].time, 0))
		{
			index = isLooping ? (sorted.length - 1) : 0;
		}
		else
		{
			for (let i = 1; i < sorted.length; i++)
			{
				if (currentTime < toFiniteNumber(sorted[i] && sorted[i].time, 0))
				{
					index = i - 1;
					break;
				}
				if (i === sorted.length - 1)
				{
					index = i;
				}
			}
		}

		const currentKey = sorted[index];
		if (!currentKey || typeof currentKey !== "object")
		{
			return [];
		}

		const tagEntries = Array.isArray(currentKey.tag)
			? currentKey.tag
			: Array.isArray(currentKey.tags)
				? currentKey.tags
				: [];
		const tags = [];
		for (const tagEntry of tagEntries)
		{
			const tagName = this._resolveTagNameFromEntry(tagEntry);
			if (tagName)
			{
				tags.push(tagName);
			}
		}

		return tags;
	}

	_resolveVarDefForLine(varline, scopeLookup)
	{
		const fallbackDef = {
			id: NaN,
			name: typeof varline.name === "string" ? varline.name : "",
			type: "float",
			defaultValue: 0
		};

		if (!varline || typeof varline !== "object")
		{
			return fallbackDef;
		}

		const rawDef = varline.def;
		if (rawDef && typeof rawDef === "object")
		{
			const normalised = this._normaliseVarDef(rawDef, toFiniteNumber(rawDef.id, NaN));
			return normalised || fallbackDef;
		}

		const byId = scopeLookup && scopeLookup.byId;
		const byName = scopeLookup && scopeLookup.byName;
		const defId = toFiniteNumber(rawDef, NaN);
		if (Number.isFinite(defId) && byId instanceof Map && byId.has(defId))
		{
			return byId.get(defId);
		}

		const defName = toLowerCaseSafe(typeof rawDef === "string" ? rawDef : varline.name);
		if (defName && byName instanceof Map && byName.has(defName))
		{
			return byName.get(defName);
		}

		return fallbackDef;
	}

	_coerceVarValue(value, type)
	{
		const lowerType = typeof type === "string" ? type.toLowerCase() : "float";
		switch (lowerType)
		{
			case "string":
				return toStringOrEmpty(value);
			case "int":
				return Math.floor(toFiniteNumber(value, 0));
			case "bool":
			case "boolean":
				return !!toFiniteNumber(value, 0);
			default:
				return toFiniteNumber(value, 0);
		}
	}

	_evaluateVarlineAtTime(varline, varDef, timeMs, animationLengthMs, isLooping)
	{
		const keys = Array.isArray(varline && varline.key) ? [...varline.key] : [];
		const type = varDef && typeof varDef.type === "string" ? varDef.type : "float";
		const defaultValue = this._coerceVarValue(varDef ? varDef.defaultValue : 0, type);
		if (!keys.length)
		{
			return defaultValue;
		}

		keys.sort((a, b) => toFiniteNumber(a && a.time, 0) - toFiniteNumber(b && b.time, 0));
		if (keys.length === 1)
		{
			return this._coerceVarValue(keys[0] && keys[0].val, type);
		}

		const currentTime = toFiniteNumber(timeMs, 0);
		let firstIndex = -1;
		let secondIndex = -1;

		for (let i = 0; i < keys.length; i++)
		{
			const keyTime = toFiniteNumber(keys[i] && keys[i].time, 0);
			if (currentTime === keyTime)
			{
				return this._coerceVarValue(keys[i] && keys[i].val, type);
			}
			if (currentTime < keyTime)
			{
				if (i > 0)
				{
					firstIndex = i - 1;
					secondIndex = i;
				}
				else if (isLooping)
				{
					firstIndex = keys.length - 1;
					secondIndex = 0;
				}
				else
				{
					return defaultValue;
				}
				break;
			}
			if (i === keys.length - 1)
			{
				if (isLooping)
				{
					firstIndex = i;
					secondIndex = 0;
				}
				else
				{
					return this._coerceVarValue(keys[i] && keys[i].val, type);
				}
			}
		}

		if (firstIndex < 0 || secondIndex < 0)
		{
			return defaultValue;
		}

		const firstKey = keys[firstIndex];
		const secondKey = keys[secondIndex];
		const firstValue = this._coerceVarValue(firstKey && firstKey.val, type);
		if (type === "string" || type === "bool" || type === "boolean")
		{
			return firstValue;
		}

		const secondValue = this._coerceVarValue(secondKey && secondKey.val, type);
		let firstTime = toFiniteNumber(firstKey && firstKey.time, 0);
		let secondTime = toFiniteNumber(secondKey && secondKey.time, firstTime);
		let sampleTime = currentTime;
		if (isLooping)
		{
			if (firstTime > sampleTime)
			{
				firstTime -= animationLengthMs;
			}
			if (secondTime < sampleTime)
			{
				secondTime += animationLengthMs;
			}
		}

		const denom = secondTime - firstTime;
		const linearT = denom > 0 ? clamp01((sampleTime - firstTime) / denom) : 0;
		const curvedT = evaluateCurveT(firstKey, linearT);
		const result = lerp(toFiniteNumber(firstValue, 0), toFiniteNumber(secondValue, toFiniteNumber(firstValue, 0)), curvedT);
		return type === "int" ? Math.floor(result) : result;
	}

	_applyMetaScopeState(scopeKey, meta, varDefsLookup, timeMs, animationLengthMs, isLooping)
	{
		if (!meta || typeof meta !== "object")
		{
			return;
		}

		const tags = this._evaluateTaglineAtTime(meta, timeMs, animationLengthMs, isLooping);
		if (tags.length)
		{
			const lowered = new Set(tags.map((name) => toLowerCaseSafe(name)).filter(Boolean));
			this._activeTagsByScope.set(scopeKey, lowered);
		}

		const varLines = this._getVarlines(meta);
		if (!varLines.length)
		{
			return;
		}

		const values = new Map();
		for (const varline of varLines)
		{
			const def = this._resolveVarDefForLine(varline, varDefsLookup);
			const keyName = toLowerCaseSafe(def && def.name);
			if (!keyName)
			{
				continue;
			}

			const value = this._evaluateVarlineAtTime(varline, def, timeMs, animationLengthMs, isLooping);
			values.set(keyName, value);
		}

		if (values.size)
		{
			this._varValuesByScope.set(scopeKey, values);
		}
	}

	_refreshMetaState(timeMs)
	{
		this._activeTagsByScope.clear();
		this._varValuesByScope.clear();

		const animation = this.animation;
		if (!animation)
		{
			return;
		}

		const sampleTime = toFiniteNumber(timeMs, this._currentAdjustedTimeMs);
		const lengthMs = Math.max(0, toFiniteNumber(this.animationLengthMs, 0));
		const isLooping = this._isAnimationLooping(animation);
		const globalVarDefs = this._varDefsByScope.get("") || { byId: this._varDefsById, byName: this._varDefsByName };

		this._applyMetaScopeState("", animation.meta, globalVarDefs, sampleTime, lengthMs, isLooping);

		const timelineList = Array.isArray(animation.timeline) ? animation.timeline : [];
		for (const timeline of timelineList)
		{
			if (!timeline || typeof timeline !== "object" || !timeline.meta)
			{
				continue;
			}

			const scopeKey = normaliseTimelineLookupName(timeline.name, this.entity && this.entity.name);
			if (!scopeKey)
			{
				continue;
			}

			const scopeVarDefs = this._varDefsByScope.get(scopeKey) || globalVarDefs;
			this._applyMetaScopeState(scopeKey, timeline.meta, scopeVarDefs, sampleTime, lengthMs, isLooping);
		}

		const soundlineList = this._getSoundlinesForAnimation(animation);
		for (const soundline of soundlineList)
		{
			if (!soundline || typeof soundline !== "object" || !soundline.meta)
			{
				continue;
			}

			const scopeKey = normaliseTimelineLookupName(soundline.name, this.entity && this.entity.name);
			if (!scopeKey)
			{
				continue;
			}

			this._applyMetaScopeState(scopeKey, soundline.meta, globalVarDefs, sampleTime, lengthMs, isLooping);
		}

		const eventlineList = this._getEventlinesForAnimation(animation);
		for (const eventline of eventlineList)
		{
			if (!eventline || typeof eventline !== "object" || !eventline.meta)
			{
				continue;
			}

			const scopeKey = normaliseTimelineLookupName(eventline.name, this.entity && this.entity.name);
			if (!scopeKey)
			{
				continue;
			}

			this._applyMetaScopeState(scopeKey, eventline.meta, globalVarDefs, sampleTime, lengthMs, isLooping);
		}
	}

	_tagActive(tagName, objectName)
	{
		const tagKey = toLowerCaseSafe(tagName);
		if (!tagKey)
		{
			return false;
		}

		if (this._activeTagsByScope.size === 0)
		{
			this._refreshMetaState(this._currentAdjustedTimeMs);
		}

		const scopeKey = objectName ? normaliseTimelineLookupName(objectName, this.entity && this.entity.name) : "";
		const tags = this._activeTagsByScope.get(scopeKey);
		return tags ? tags.has(tagKey) : false;
	}

	_val(varName, objectName)
	{
		const key = toLowerCaseSafe(varName);
		if (!key)
		{
			return 0;
		}

		if (this._varValuesByScope.size === 0)
		{
			this._refreshMetaState(this._currentAdjustedTimeMs);
		}

		const scopeKey = objectName ? normaliseTimelineLookupName(objectName, this.entity && this.entity.name) : "";
		const vars = this._varValuesByScope.get(scopeKey);
		if (!vars)
		{
			return 0;
		}

		return vars.has(key) ? vars.get(key) : 0;
	}

	_getMainlineAdjustedTime(mainKeys, mainKeyIndex, timeMs)
	{
		if (!Array.isArray(mainKeys) || !mainKeys.length)
		{
			return timeMs;
		}

		const animationLengthMs = this.animationLengthMs;
		const startIndex = clamp(toFiniteNumber(mainKeyIndex, 0), 0, mainKeys.length - 1);
		const startKey = mainKeys[startIndex];
		if (!startKey)
		{
			return timeMs;
		}

		const nextIndex = (startIndex + 1) % mainKeys.length;
		const nextKey = mainKeys[nextIndex] || startKey;
		const startTime = toFiniteNumber(startKey.time, 0);
		let endTime = toFiniteNumber(nextKey.time, 0);
		let sampleTime = timeMs;

		if (nextIndex === 0)
		{
			endTime += animationLengthMs;
			if (sampleTime < startTime)
			{
				sampleTime += animationLengthMs;
			}
		}

		const denom = endTime - startTime;
		const linearT = denom > 0 ? clamp01((sampleTime - startTime) / denom) : 0;
		const curvedT = evaluateCurveT(startKey, linearT);
		return lerp(startTime, endTime, curvedT);
	}

	_findKeyIndexForTime(keys, timeMs)
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

	_resolveBoneTransform(boneRef, timeMs, boneRefsById, boneWorldById, overrideWorldById = null)
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

		if (overrideWorldById && overrideWorldById.has(boneId))
		{
			const overridden = overrideWorldById.get(boneId);
			boneWorldById.set(boneId, overridden);
			return overridden;
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
			const parentWorld = this._resolveBoneTransform(parentRef, timeMs, boneRefsById, boneWorldById, overrideWorldById);
			if (parentWorld)
			{
				world = combineTransforms(parentWorld, local);
			}
		}

		boneWorldById.set(boneId, world);
		return world;
	}

	_applyIkToWorldBones(targetX, targetY, additionalLength, parentBone, childBoneAbs, childBoneLocal, childBoneLength)
	{
		if (!parentBone || !childBoneAbs || !childBoneLocal)
		{
			return null;
		}

		const parent = {
			...parentBone
		};
		const childLocal = {
			...childBoneLocal
		};

		const parentScaleX = toFiniteNumber(parent.scaleX, 1);
		const parentScaleY = toFiniteNumber(parent.scaleY, 1);
		const childLocalScaleX = toFiniteNumber(childLocal.scaleX, 1);
		const twoPi = Math.PI * 2;
		const rad180 = Math.PI;
		const rad270 = Math.PI * 1.5;

		const distanceAB = Math.hypot(
			toFiniteNumber(childLocal.x, 0) * parentScaleX,
			toFiniteNumber(childLocal.y, 0) * parentScaleY
		);
		const distanceATarget = Math.hypot(
			toFiniteNumber(parent.x, 0) - toFiniteNumber(targetX, 0),
			toFiniteNumber(parent.y, 0) - toFiniteNumber(targetY, 0)
		);
		const distanceBTarget = Math.abs(toFiniteNumber(childBoneLength, 0) * childLocalScaleX * parentScaleX) + toFiniteNumber(additionalLength, 0);
		const parentBoneFactor = (parentScaleX * parentScaleY) < 0;
		const previousParentAngle = toFiniteNumber(parent.angle, 0);

		if (!(distanceAB > 0) || !(distanceATarget > 0))
		{
			const child = combineTransforms(parent, childLocal);
			child.angle = toFiniteNumber(child.angle, toFiniteNumber(childBoneAbs.angle, 0));
			return {
				parentBone: parent,
				childBone: child
			};
		}

		if (distanceATarget > distanceAB + distanceBTarget)
		{
			let newAngle = rad270 - Math.atan2(
				toFiniteNumber(parent.x, 0) - toFiniteNumber(targetX, 0),
				toFiniteNumber(parent.y, 0) - toFiniteNumber(targetY, 0)
			);
			if (parentScaleX < 0)
			{
				newAngle -= rad180;
			}
			if (this._xFlip)
			{
				newAngle -= rad180;
			}
			parent.angle = newAngle;
		}
		else
		{
			const xDiff = toFiniteNumber(parent.x, 0) - toFiniteNumber(targetX, 0);
			const yDiff = toFiniteNumber(parent.y, 0) - toFiniteNumber(targetY, 0);
			const acosDenominator = 2 * distanceAB * distanceATarget;
			let newAngle = 0;
			if (acosDenominator !== 0)
			{
				const cosValue = (
					(distanceAB * distanceAB) +
					(distanceATarget * distanceATarget) -
					(distanceBTarget * distanceBTarget)
				) / acosDenominator;
				newAngle = Math.acos(clamp(cosValue, -1, 1));
			}

			const angleOffset = rad270 - Math.atan2(xDiff, yDiff);
			let childAngleOffset = (
				rad270 - Math.atan2(
					toFiniteNumber(parent.x, 0) - toFiniteNumber(childBoneAbs.x, 0),
					toFiniteNumber(parent.y, 0) - toFiniteNumber(childBoneAbs.y, 0)
				)
			) - previousParentAngle;
			const ikReversal = toFiniteNumber(childLocal.angle, 0) > 0;

			newAngle = angleOffset + (newAngle * (ikReversal ? -1 : 1) * (parentBoneFactor ? -1 : 1));
			if (parentScaleX < 0)
			{
				childAngleOffset -= rad180;
			}
			newAngle -= childAngleOffset;

			if (!Number.isFinite(newAngle))
			{
				newAngle = previousParentAngle;
			}
			else if (parentScaleX < 0)
			{
				newAngle -= rad180;
			}

			parent.angle = newAngle;
		}

		const child = combineTransforms(parent, childLocal);
		let childAngle = rad270 - Math.atan2(
			toFiniteNumber(child.x, 0) - toFiniteNumber(targetX, 0),
			toFiniteNumber(child.y, 0) - toFiniteNumber(targetY, 0)
		);
		if (toFiniteNumber(child.scaleX, 1) < 0)
		{
			childAngle -= rad180;
		}
		if (this._xFlip)
		{
			childAngle -= rad180;
		}
		if (parentBoneFactor)
		{
			childAngle = (twoPi - childAngle) * -1;
		}
		child.angle = childAngle;

		return {
			parentBone: parent,
			childBone: child
		};
	}

	_applyBoneIkOverrides(boneRefs, boneRefsById, boneWorldById, timeMs)
	{
		if (!this._boneIkOverridesByName || this._boneIkOverridesByName.size === 0)
		{
			return;
		}

		const boneRefByName = new Map();
		const childRefsByParentId = new Map();

		for (const boneRef of boneRefs)
		{
			if (!boneRef)
			{
				continue;
			}

			const id = toFiniteNumber(boneRef.id, NaN);
			const parentId = toFiniteNumber(boneRef.parent, NaN);
			if (Number.isFinite(parentId))
			{
				if (!childRefsByParentId.has(parentId))
				{
					childRefsByParentId.set(parentId, []);
				}
				childRefsByParentId.get(parentId).push(boneRef);
			}

			const timelineId = toFiniteNumber(boneRef.timeline, NaN);
			const timelineName = this._timelineNameById.get(timelineId) || "";
			const key = normaliseTimelineLookupName(timelineName, this.entity && this.entity.name);
			if (key && Number.isFinite(id) && !boneRefByName.has(key))
			{
				boneRefByName.set(key, boneRef);
			}
		}

		const overrideWorldById = new Map();

		for (const [parentBoneName, ikOverride] of this._boneIkOverridesByName)
		{
			const parentRef = boneRefByName.get(parentBoneName);
			if (!parentRef || !ikOverride)
			{
				continue;
			}

			const parentId = toFiniteNumber(parentRef.id, NaN);
			if (!Number.isFinite(parentId))
			{
				continue;
			}

			let childRef = null;
			if (ikOverride.childBone)
			{
				childRef = boneRefByName.get(ikOverride.childBone) || null;
			}
			if (!childRef)
			{
				const directChildren = childRefsByParentId.get(parentId) || [];
				childRef = directChildren.length ? directChildren[0] : null;
			}
			if (!childRef)
			{
				continue;
			}

			const childId = toFiniteNumber(childRef.id, NaN);
			if (!Number.isFinite(childId))
			{
				continue;
			}

			const parentWorld = overrideWorldById.get(parentId) || boneWorldById.get(parentId);
			const childWorld = overrideWorldById.get(childId) || boneWorldById.get(childId);
			if (!parentWorld || !childWorld)
			{
				continue;
			}

			const childTimelineId = toFiniteNumber(childRef.timeline, NaN);
			const childTimeline = this._timelineById.get(childTimelineId);
			const childLocal = this._evaluateTimelineTransform(childTimeline, toFiniteNumber(childRef.key, 0), timeMs);
			if (!childLocal)
			{
				continue;
			}

			const childTimelineName = this._timelineNameById.get(childTimelineId) || "";
			const childBoneLength = this._getBoneLengthForTimelineName(childTimelineName);
			const solved = this._applyIkToWorldBones(
				toFiniteNumber(ikOverride.targetX, 0),
				toFiniteNumber(ikOverride.targetY, 0),
				toFiniteNumber(ikOverride.additionalLength, 0),
				parentWorld,
				childWorld,
				childLocal,
				childBoneLength
			);
			if (!solved || !solved.parentBone || !solved.childBone)
			{
				continue;
			}

			overrideWorldById.set(parentId, solved.parentBone);
			overrideWorldById.set(childId, solved.childBone);
		}

		if (!overrideWorldById.size)
		{
			return;
		}

		boneWorldById.clear();
		for (const boneRef of boneRefs)
		{
			this._resolveBoneTransform(boneRef, timeMs, boneRefsById, boneWorldById, overrideWorldById);
		}
	}

	_evaluateObjectRef(objectRef, timeMs, boneRefsById, boneWorldById)
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

		const timelineName = this._timelineNameById.get(timelineId) || "";
		let folder = evaluated.folder;
		let file = evaluated.file;
		const charMapEntry = this._resolveCharacterMapForState(timelineName, folder, file);
		if (charMapEntry)
		{
			if (charMapEntry.hidden)
			{
				return null;
			}

			folder = charMapEntry.folder;
			file = charMapEntry.file;
		}

		const fileInfo = this._getFileInfo(folder, file);
		const state = {
			folder,
			file,
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
			name: fileInfo ? fileInfo.name : "",
			timelineName,
			atlasIndex: fileInfo ? toFiniteNumber(fileInfo.atlasIndex, 0) : 0,
			atlasW: fileInfo ? toFiniteNumber(fileInfo.atlasW, 0) : 0,
			atlasH: fileInfo ? toFiniteNumber(fileInfo.atlasH, 0) : 0,
			atlasX: fileInfo ? toFiniteNumber(fileInfo.atlasX, 0) : 0,
			atlasY: fileInfo ? toFiniteNumber(fileInfo.atlasY, 0) : 0,
			atlasXOff: fileInfo ? toFiniteNumber(fileInfo.atlasXOff, 0) : 0,
			atlasYOff: fileInfo ? toFiniteNumber(fileInfo.atlasYOff, 0) : 0,
			atlasRotated: fileInfo ? !!fileInfo.atlasRotated : false
		};
		this._applyObjectComponentOverrides(state);

		return state;
	}

	_evaluateTimelineTransform(timeline, keyIndex, timeMs)
	{
		const keys = timeline && Array.isArray(timeline.key) ? timeline.key : [];
		if (!keys.length)
		{
			return null;
		}

		const startIndex = clamp(toFiniteNumber(keyIndex, 0), 0, keys.length - 1);
		const startKey = keys[startIndex];
		const nextIndex = (startIndex + 1) % keys.length;
		let nextKey = keys[nextIndex];
		if (!nextKey)
		{
			nextKey = startKey;
		}

		const lengthMs = this.animationLengthMs;
		const startTime = toFiniteNumber(startKey.time, 0);
		let endTime = toFiniteNumber(nextKey && nextKey.time, 0);
		let sampleTime = timeMs;
		const isLooping = this._isAnimationLooping(this.animation);

		if (nextIndex === 0 && isLooping)
		{
			endTime += lengthMs;
			if (sampleTime < startTime)
			{
				sampleTime += lengthMs;
			}
		}
		else if (nextIndex === 0 && !isLooping)
		{
			nextKey = startKey;
			endTime = startTime;
		}

		const denom = endTime - startTime;
		const linearT = denom > 0 ? clamp01((sampleTime - startTime) / denom) : 0;
		const t = evaluateCurveT(startKey, linearT);

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
			// Spriter and Construct use opposite Y axis directions for timeline bone offsets.
			y: -lerp(toFiniteNumber(startBone.y, 0), toFiniteNumber(endBone.y, toFiniteNumber(startBone.y, 0)), t),
			angle: degreesToRadians(angleDeg),
			scaleX: lerp(toFiniteNumber(startBone.scale_x, 1), toFiniteNumber(endBone.scale_x, toFiniteNumber(startBone.scale_x, 1)), t),
			scaleY: lerp(toFiniteNumber(startBone.scale_y, 1), toFiniteNumber(endBone.scale_y, toFiniteNumber(startBone.scale_y, 1)), t),
			alpha: lerp(toFiniteNumber(startBone.a, 1), toFiniteNumber(endBone.a, toFiniteNumber(startBone.a, 1)), t)
		};
	}

	_evaluateTimelineObject(timeline, keyIndex, timeMs)
	{
		const keys = timeline && Array.isArray(timeline.key) ? timeline.key : [];
		if (!keys.length)
		{
			return null;
		}

		const startIndex = clamp(toFiniteNumber(keyIndex, 0), 0, keys.length - 1);
		const startKey = keys[startIndex];
		const nextIndex = (startIndex + 1) % keys.length;
		let nextKey = keys[nextIndex];
		if (!nextKey)
		{
			nextKey = startKey;
		}

		const lengthMs = this.animationLengthMs;
		const startTime = toFiniteNumber(startKey.time, 0);
		let endTime = toFiniteNumber(nextKey && nextKey.time, 0);
		let sampleTime = timeMs;
		const isLooping = this._isAnimationLooping(this.animation);

		if (nextIndex === 0 && isLooping)
		{
			endTime += lengthMs;
			if (sampleTime < startTime)
			{
				sampleTime += lengthMs;
			}
		}
		else if (nextIndex === 0 && !isLooping)
		{
			nextKey = startKey;
			endTime = startTime;
		}

		const denom = endTime - startTime;
		const linearT = denom > 0 ? clamp01((sampleTime - startTime) / denom) : 0;
		const t = evaluateCurveT(startKey, linearT);

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

		const pivotX = toFiniteNumber(startObj.pivot_x, NaN);
		let pivotY = toFiniteNumber(startObj.pivot_y, NaN);

		// Spriter stores pivots in a coordinate system where pivot_y is inverted vs Construct.
		// Match legacy plugin behaviour by converting pivot_y to Construct-style.
		if (startObj && Object.prototype.hasOwnProperty.call(startObj, "pivot_y"))
		{
			pivotY = Number.isFinite(pivotY) ? 1 - pivotY : pivotY;
		}

		return {
			folder,
			file,
			pivotX,
			pivotY,
			transform: {
				x: lerp(toFiniteNumber(startObj.x, 0), toFiniteNumber(endObj.x, toFiniteNumber(startObj.x, 0)), t),
				// Spriter and Construct use opposite Y axis directions for timeline object offsets.
				y: -lerp(toFiniteNumber(startObj.y, 0), toFiniteNumber(endObj.y, toFiniteNumber(startObj.y, 0)), t),
				angle: degreesToRadians(angleDeg),
				scaleX: lerp(toFiniteNumber(startObj.scale_x, 1), toFiniteNumber(endObj.scale_x, toFiniteNumber(startObj.scale_x, 1)), t),
				scaleY: lerp(toFiniteNumber(startObj.scale_y, 1), toFiniteNumber(endObj.scale_y, toFiniteNumber(startObj.scale_y, 1)), t),
				alpha: lerp(toFiniteNumber(startObj.a, 1), toFiniteNumber(endObj.a, toFiniteNumber(startObj.a, 1)), t)
			}
		};
	}

	_getFileInfo(folderId, fileId)
	{
		if (!Number.isFinite(folderId) || !Number.isFinite(fileId))
		{
			return null;
		}

		return this._fileLookup.get(`${folderId}:${fileId}`) || null;
	}

	_initPlaybackFromProject(projectData)
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
		this.secondAnimation = null;
		this.animBlend = 0;
		this._resetAutoBlendState();
		this._playToTimeMs = -1;
		this._currentMainlineKeyIndex = 0;

		if (this._pendingLoopOverride != null)
		{
			const key = `${entityIndex}:${animationIndex}`;
			this._loopOverrideByAnimationIndex.set(key, !!this._pendingLoopOverride);
			this._pendingLoopOverride = null;
		}

		this.localTimeMs = 0;
		this.playing = true;
		this._lastTickTimeSec = null;
		this._triggeredEventName = "";
		this._activeTagsByScope.clear();
		this._varValuesByScope.clear();
		this._activeCharMapNames.length = 0;
		this._resolvedCharMapByObject.clear();
		this._resolvedCharMapGlobal.clear();
		this._objectOverridesByName.clear();
		this._boneIkOverridesByName.clear();

		this._buildTagDefLookup(projectData);
		this._buildVarDefLookup(entity);

		this._buildObjectArray();
		this._refreshAssociatedFrameLookups();

		this._fileLookup.clear();
		this._atlasImagePathByIndex.clear();
		const atlasEntries = Array.isArray(projectData && projectData.atlas) ? projectData.atlas : [];
		for (let atlasIndex = 0; atlasIndex < atlasEntries.length; atlasIndex++)
		{
			const atlasEntry = atlasEntries[atlasIndex];
			const atlasName = atlasEntry && typeof atlasEntry.name === "string"
				? atlasEntry.name
				: atlasEntry && typeof atlasEntry.file === "string"
					? atlasEntry.file
					: atlasEntry && typeof atlasEntry.image === "string"
						? atlasEntry.image
						: "";
			const atlasImagePath = toAtlasImagePath(atlasName);
			if (atlasImagePath)
			{
				this._atlasImagePathByIndex.set(atlasIndex, atlasImagePath);
			}
		}

		const folders = Array.isArray(projectData.folder) ? projectData.folder : [];
		for (let folderIndex = 0; folderIndex < folders.length; folderIndex++)
		{
			const folder = folders[folderIndex];
			const folderId = toFiniteNumber(folder && folder.id, folderIndex);
			const folderAtlasIndex = toFiniteNumber(folder && folder.atlas, 0);

			const filesSource = folder && Array.isArray(folder.file)
				? folder.file
				: folder && Array.isArray(folder.files)
					? folder.files
					: [];

			for (let fileIndex = 0; fileIndex < filesSource.length; fileIndex++)
			{
				const file = filesSource[fileIndex];
				const fileId = toFiniteNumber(file && file.id, fileIndex);

				const widthFallback = toFiniteNumber(file && file.aw, 0);
				const heightFallback = toFiniteNumber(file && file.ah, 0);

				const width = toFiniteNumber(file && (file.width ?? file.w), widthFallback);
				const height = toFiniteNumber(file && (file.height ?? file.h), heightFallback);

				const pivotX = toFiniteNumber(file && (file.pivotX ?? file.pivot_x), 0);
				let pivotY = toFiniteNumber(file && (file.pivotY ?? file.pivot_y), 0);

				if (file && Object.prototype.hasOwnProperty.call(file, "pivot_y") && !Object.prototype.hasOwnProperty.call(file, "pivotY"))
				{
					pivotY = 1 - pivotY;
				}

				const atlasIndex = toFiniteNumber(file && file.atlas, folderAtlasIndex);
				const atlasW = toFiniteNumber(file && file.aw, 0);
				const atlasH = toFiniteNumber(file && file.ah, 0);
				const atlasX = toFiniteNumber(file && file.ax, 0);
				const atlasY = toFiniteNumber(file && file.ay, 0);
				const atlasXOff = toFiniteNumber(file && file.axoff, 0);
				const atlasYOff = toFiniteNumber(file && file.ayoff, 0);
				const atlasRotated = toBoolean(file && file.arot, false);

				this._fileLookup.set(`${folderId}:${fileId}`, {
					name: file && typeof file.name === "string" ? file.name : "",
					width,
					height,
					pivotX,
					pivotY,
					atlasIndex,
					atlasW,
					atlasH,
					atlasX,
					atlasY,
					atlasXOff,
					atlasYOff,
					atlasRotated
				});
			}
		}

		this._buildObjectInfoLookup(entity);
		this._buildCharacterMapLookup(entity);

		this._rebuildAnimationTimelineCache(animation);

		this._buildSoundLineCache();
		this._buildEventLineCache();
		this._applyAnimationBoundsToWorldInfo(animation);

		// Ensure we have an evaluated pose ready for the first draw.
		this._evaluatePose();
		this._refreshMetaState(this._currentAdjustedTimeMs);
		this._evaluateSoundLines(this._currentAdjustedTimeMs, true);
		this._evaluateEventLines(this._currentAdjustedTimeMs, true);
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

		const sdkType = this.objectType;
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
			.then((projectData) =>
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
			.catch((error) =>
			{
				if (this._isReleased)
				{
					return;
				}

				this._setLoadError(error);
			});
	}

	_setLoadError(error)
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

		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnReady === "function")
		{
			this._trigger(cnds.OnReady);
		}
		if (typeof this._trigger === "function" && cnds && typeof cnds.readyForSetup === "function")
		{
			this._trigger(cnds.readyForSetup);
		}
	}

	_triggerOnLoadFailed()
	{
		if (this._didTriggerLoadFailed)
		{
			return;
		}

		this._didTriggerLoadFailed = true;

		const cnds = C3.Plugins.Spriter.Cnds;
		if (typeof this._trigger === "function" && cnds && typeof cnds.OnLoadFailed === "function")
		{
			this._trigger(cnds.OnLoadFailed);
		}
	}

	_onRendererContextLost()
	{
		// If the renderer (e.g. WebGL) context is lost, any addon-created textures become invalid.
		// Clear the shared cache so textures will be reloaded lazily on the next draw.
		const sdkType = this.objectType;
		if (sdkType && typeof sdkType._releaseAllTextures === "function")
		{
			sdkType._releaseAllTextures();
		}

		if (this._atlasTextureLoadState)
		{
			this._atlasTextureLoadState.clear();
		}
		if (this._atlasFrameCache)
		{
			this._atlasFrameCache.clear();
		}
		if (this._atlasDebug && this._atlasDebug.pendingTextureIndices)
		{
			this._atlasDebug.pendingTextureIndices.clear();
		}
		if (this._atlasDebug && this._atlasDebug.missingAtlasImageIndices)
		{
			this._atlasDebug.missingAtlasImageIndices.clear();
		}
	}
	
	// ───── Non-self-draw infrastructure ─────

	_buildObjectArray()
	{
		this._objectArray = [];
		// Don't clear _c2ObjectMap here — associations persist across animation changes

		const entity = this.entity;
		if (!entity) return;

		const entityNamePrefix = entity.name ? entity.name + "_" : "";
		const seen = new Set();
		const animations = Array.isArray(entity.animation) ? entity.animation : [];
		for (const anim of animations)
		{
			const timelines = Array.isArray(anim.timeline) ? anim.timeline : [];
			for (const tl of timelines)
			{
				let name = tl.name || "";
				if (entityNamePrefix && name.startsWith(entityNamePrefix))
				{
					name = name.slice(entityNamePrefix.length);
				}
				const objType = tl.object_type || "sprite";
				if (name && !seen.has(name) && objType !== "bone")
				{
					seen.add(name);
					this._objectArray.push({
						name,
						entityName: entity.name || "",
						spriterType: objType
					});
				}
			}
		}
	}

	_getWorldInfoOf(inst)
	{
		// SDK v1: GetWorldInfo() returns a WorldInfo object
		if (typeof inst.GetWorldInfo === "function")
			return inst.GetWorldInfo();
		if (typeof inst.getWorldInfo === "function")
			return inst.getWorldInfo();
		if (inst._inst && typeof inst._inst.GetWorldInfo === "function")
			return inst._inst.GetWorldInfo();
		if (inst._inst && typeof inst._inst.getWorldInfo === "function")
			return inst._inst.getWorldInfo();

		// SDK v2: no WorldInfo object — position/size/angle are direct properties
		// on the instance (this.x, this.y, this.angle, etc.).
		// Return an adapter that maps WorldInfo method calls to direct property access.
		if (typeof inst.x === "number" && typeof inst.y === "number")
		{
			return {
				GetX() { return inst.x; },
				GetY() { return inst.y; },
				SetX(v) { inst.x = v; },
				SetY(v) { inst.y = v; },
				GetAngle() { return inst.angle || 0; },
				SetAngle(v) { inst.angle = v; },
				GetWidth() { return inst.width || 0; },
				SetWidth(v) { inst.width = v; },
				GetHeight() { return inst.height || 0; },
				SetHeight(v) { inst.height = v; },
				IsVisible() { return inst.isVisible !== false; },
				SetVisible(v) { inst.isVisible = v; },
				GetOpacity() { return inst.opacity != null ? inst.opacity : 1; },
				SetOpacity(v) { inst.opacity = v; },
				SetOriginX(v) { /* v2: origin managed differently */ },
				SetOriginY(v) { /* v2: origin managed differently */ },
				SetBboxChanged() { /* v2: automatic when properties change */ },
				SetCollisionEnabled(v) { /* v2: not applicable via WorldInfo */ },
				ZOrderMoveAdjacentToInstance(other, isAfter) {
					if (typeof inst.moveAdjacentToInstance === "function")
						inst.moveAdjacentToInstance(other, isAfter);
				}
			};
		}

		console.warn("[Spriter] _getWorldInfoOf: could not resolve worldInfo for", inst);
		return null;
	}

	_getIID()
	{
		// SDK v2 (ISDKWorldInstanceBase) may expose GetIID() directly,
		// or the internal _inst property may have it.
		if (typeof this.GetIID === "function")
			return this.GetIID();
		if (this._inst && typeof this._inst.GetIID === "function")
			return this._inst.GetIID();
		// Fallback: match WorldInfo against our object type's instances
		try
		{
			const wi = this._getWorldInfoOf(this);
			const allInsts = this._getInstancesOf(this.objectType);
			for (let i = 0; i < allInsts.length; i++)
			{
				if (this._getWorldInfoOf(allInsts[i]) === wi)
					return i;
			}
		}
		catch (e) { /* ignore */ }
		return 0;
	}

	_getInstancesOf(objType)
	{
		// SDK v1: GetInstances() returns an array.
		if (typeof objType.GetInstances === "function")
			return Array.from(objType.GetInstances());
		// SDK v2: getAllInstances() returns an array.
		if (typeof objType.getAllInstances === "function")
			return Array.from(objType.getAllInstances());
		// SDK v2: instances() may return an iterator.
		if (typeof objType.instances === "function")
			return Array.from(objType.instances());
		if (Array.isArray(objType._instances))
			return objType._instances;
		return [];
	}

	_getObjectTypeName(objType)
	{
		if (typeof objType.GetName === "function")
			return objType.GetName();
		if (typeof objType.name === "string")
			return objType.name;
		return "?";
	}

	_buildFrameLookupForSpriterName(spriterName)
	{
		const name = normaliseSpriterObjectName(spriterName);
		if (!name)
		{
			return null;
		}

		const entity = this.entity;
		const objInfos = entity && Array.isArray(entity.obj_info) ? entity.obj_info : [];
		if (!objInfos.length)
		{
			return null;
		}

		for (const objInfo of objInfos)
		{
			if (!objInfo || typeof objInfo !== "object")
			{
				continue;
			}

			const objType = typeof objInfo.type === "string"
				? objInfo.type.trim().toLowerCase()
				: "sprite";

			if (objType && objType !== "sprite")
			{
				continue;
			}

			const rawName = typeof objInfo.name === "string" ? objInfo.name : "";
			const strippedName = stripEntityPrefix(rawName, entity && entity.name ? entity.name : "");
			if (strippedName !== name)
			{
				continue;
			}

			const frames = Array.isArray(objInfo.frames) ? objInfo.frames : [];
			const frameLookup = new Map();
			for (let i = 0; i < frames.length; i++)
			{
				const frame = frames[i];
				if (!frame || typeof frame !== "object")
				{
					continue;
				}

				const folder = toFiniteNumber(frame.folder, NaN);
				const file = toFiniteNumber(frame.file, NaN);
				if (!Number.isFinite(folder) || !Number.isFinite(file))
				{
					continue;
				}

				const key = makeFolderFileKey(folder, file);
				if (!frameLookup.has(key))
				{
					frameLookup.set(key, i);
				}
			}

			return frameLookup;
		}

		return null;
	}

	_refreshAssociatedFrameLookups()
	{
		for (const [name, entry] of this._c2ObjectMap)
		{
			if (!entry)
			{
				continue;
			}

			entry.frameLookup = this._buildFrameLookupForSpriterName(name);
			entry.missingFrameKeys = new Set();
			entry.lastAppliedFrame = -1;
		}
	}

	_resolveFrameIndexForState(c2Entry, state)
	{
		if (!c2Entry || !state)
		{
			return -1;
		}

		if (!(c2Entry.frameLookup instanceof Map) || !c2Entry.frameLookup.size)
		{
			c2Entry.frameLookup = this._buildFrameLookupForSpriterName(state.timelineName);
			c2Entry.missingFrameKeys = new Set();
		}

		const frameLookup = c2Entry.frameLookup;
		if (!(frameLookup instanceof Map) || !frameLookup.size)
		{
			return -1;
		}

		const folder = toFiniteNumber(state.folder, NaN);
		const file = toFiniteNumber(state.file, NaN);
		if (!Number.isFinite(folder) || !Number.isFinite(file))
		{
			return -1;
		}

		const key = makeFolderFileKey(folder, file);
		if (frameLookup.has(key))
		{
			return toFiniteNumber(frameLookup.get(key), -1);
		}

		if (!(c2Entry.missingFrameKeys instanceof Set))
		{
			c2Entry.missingFrameKeys = new Set();
		}

		if (!c2Entry.missingFrameKeys.has(key))
		{
			c2Entry.missingFrameKeys.add(key);
			console.warn(`[Spriter] Non-self-draw frame missing for '${state.timelineName}' at folder=${folder}, file=${file}.`);
		}

		return -1;
	}

	_getSdkInstanceOf(inst)
	{
		if (!inst)
		{
			return null;
		}

		if (typeof inst.GetSdkInstance === "function")
		{
			const sdkInst = inst.GetSdkInstance();
			if (sdkInst)
			{
				return sdkInst;
			}
		}

		if (typeof inst.getSdkInstance === "function")
		{
			const sdkInst = inst.getSdkInstance();
			if (sdkInst)
			{
				return sdkInst;
			}
		}

		if (inst._sdkInstance)
		{
			return inst._sdkInstance;
		}

		if (inst._sdkInst)
		{
			return inst._sdkInst;
		}

		if (inst._inst && inst._inst !== inst)
		{
			return this._getSdkInstanceOf(inst._inst);
		}

		return null;
	}

	_getCurrentSpriteFrameIndex(inst, sdkInst)
	{
		const candidates = [sdkInst, inst];
		const getters = ["_GetAnimFrame", "_getAnimFrame", "GetAnimFrame", "getAnimFrame", "GetAnimationFrame", "getAnimationFrame"];
		const properties = ["animationFrame", "_currentFrameIndex", "currentFrameIndex", "_animFrame", "animFrame"];

		for (const target of candidates)
		{
			if (!target)
			{
				continue;
			}

			for (const fnName of getters)
			{
				if (typeof target[fnName] !== "function")
				{
					continue;
				}

				const value = Number(target[fnName]());
				if (Number.isFinite(value))
				{
					return Math.floor(value);
				}
			}

			for (const propName of properties)
			{
				const value = Number(target[propName]);
				if (Number.isFinite(value))
				{
					return Math.floor(value);
				}
			}
		}

		return -1;
	}

	_setSpriteFrameByIndex(inst, frameIndex)
	{
		if (!inst || !Number.isInteger(frameIndex) || frameIndex < 0)
		{
			return false;
		}

		const sdkInst = this._getSdkInstanceOf(inst);
		const candidateTargets = [inst, sdkInst, inst ? inst._inst : null, sdkInst ? sdkInst._inst : null]
			.filter((v, i, arr) => !!v && arr.indexOf(v) === i);
		const currentFrame = this._getCurrentSpriteFrameIndex(inst, sdkInst);
		if (currentFrame === frameIndex)
		{
			return true;
		}

		// Scripting API path (ISpriteInstance): `animationFrame` is the current frame index.
		for (const target of candidateTargets)
		{
			if (!target || !("animationFrame" in target))
			{
				continue;
			}

			try
			{
				target.animationFrame = frameIndex;
				if (Number(target.animationFrame) === frameIndex)
				{
					return true;
				}
			}
			catch (err)
			{
				// Continue with other fallbacks.
			}
		}

		const directSetters = ["SetAnimFrame", "setAnimFrame", "SetAnimationFrame", "setAnimationFrame"];
		for (const target of candidateTargets)
		{
			if (!target)
			{
				continue;
			}

			for (const fnName of directSetters)
			{
				if (typeof target[fnName] === "function")
				{
					target[fnName](frameIndex);
					return true;
				}
			}
		}

		if (sdkInst)
		{
			sdkInst._changeAnimFrameIndex = frameIndex;

			const isTicking = typeof sdkInst.IsTicking === "function"
				? sdkInst.IsTicking.bind(sdkInst)
				: typeof sdkInst.isTicking === "function"
					? sdkInst.isTicking.bind(sdkInst)
					: null;

			const startTicking = typeof sdkInst._StartTicking === "function"
				? sdkInst._StartTicking.bind(sdkInst)
				: typeof sdkInst.startTicking === "function"
					? sdkInst.startTicking.bind(sdkInst)
					: null;

			if (isTicking && startTicking && !isTicking())
			{
				startTicking();
			}

			const doChange = typeof sdkInst._DoChangeAnimFrame === "function"
				? sdkInst._DoChangeAnimFrame.bind(sdkInst)
				: typeof sdkInst.doChangeAnimFrame === "function"
					? sdkInst.doChangeAnimFrame.bind(sdkInst)
					: null;

			if (doChange && !sdkInst._isInAnimTrigger)
			{
				doChange();
				return true;
			}

			const frameProps = ["_currentFrameIndex", "currentFrameIndex"];
			for (const propName of frameProps)
			{
				if (propName in sdkInst)
				{
					sdkInst[propName] = frameIndex;
					const updateTexture = typeof sdkInst._UpdateCurrentTexture === "function"
						? sdkInst._UpdateCurrentTexture.bind(sdkInst)
						: typeof sdkInst.updateCurrentTexture === "function"
							? sdkInst.updateCurrentTexture.bind(sdkInst)
							: null;
					if (updateTexture)
					{
						updateTexture();
					}
					return true;
				}
			}
		}

		if (!this._didWarnSpriteFrameApiUnavailable)
		{
			this._didWarnSpriteFrameApiUnavailable = true;
			const gatherAnimKeys = (obj) =>
			{
				if (!obj || (typeof obj !== "object" && typeof obj !== "function"))
				{
					return [];
				}

				const names = new Set();
				let proto = obj;
				let depth = 0;
				while (proto && depth < 3)
				{
					for (const key of Object.getOwnPropertyNames(proto))
					{
						if (/anim|frame/i.test(key))
						{
							names.add(key);
						}
					}
					proto = Object.getPrototypeOf(proto);
					depth++;
				}

				return Array.from(names).sort();
			};

			const instKeys = gatherAnimKeys(inst).join(", ");
			const sdkKeys = gatherAnimKeys(sdkInst).join(", ");
			console.warn("[Spriter] Non-self-draw sprite frame API unavailable; image swaps may not work in this runtime.");
			console.warn(`[Spriter] Frame API probe keys: inst=[${instKeys}], sdkInst=[${sdkKeys}]`);
		}

		return false;
	}

	_associateTypeWithName(objectType, spriterName)
	{
		const resolvedName = normaliseSpriterObjectName(spriterName);
		if (!resolvedName || !objectType)
		{
			return;
		}

		const myIID = this._getIID();
		const instances = this._getInstancesOf(objectType);
		const pairedInst = instances[myIID] || null;
		const frameLookup = this._buildFrameLookupForSpriterName(resolvedName);

		const apis = [
			typeof objectType.GetInstances === "function" ? "GetInstances" : null,
			typeof objectType.getAllInstances === "function" ? "getAllInstances" : null,
			typeof objectType.instances === "function" ? "instances" : null,
			Array.isArray(objectType._instances) ? "_instances" : null
		].filter(Boolean).join(",");
		const frameCount = frameLookup instanceof Map ? frameLookup.size : 0;
		console.log(`[Spriter] _associateTypeWithName: spriterName='${resolvedName}', typeName='${this._getObjectTypeName(objectType)}', myIID=${myIID}, instanceCount=${instances.length}, pairedInst=${pairedInst ? "found" : "NULL"}, frameMap=${frameCount}, apis=[${apis}]`);

		this._c2ObjectMap.set(resolvedName, {
			type: objectType,
			inst: pairedInst,
			spriterType: "sprite",
			frameLookup,
			lastAppliedFrame: -1,
			missingFrameKeys: new Set()
		});
	}

	_resolveC2Instances(c2Object)
	{
		if (!c2Object)
		{
			return [];
		}

		try
		{
			if (typeof c2Object.GetSolStack === "function")
			{
				const sol = c2Object.GetSolStack()._current;
				if (sol)
				{
					let instances = Array.isArray(sol._instances) ? sol._instances : [];
					if (!instances.length && sol._selectAll === true && Array.isArray(c2Object._instances))
					{
						instances = c2Object._instances;
					}
					return Array.from(instances);
				}
			}
		}
		catch (error)
		{
			console.warn("[Spriter] Failed to resolve picked instances for object mapping.", error);
		}

		if (typeof c2Object.GetFirstPicked === "function")
		{
			const picked = c2Object.GetFirstPicked();
			return picked ? [picked] : [];
		}

		if (typeof c2Object.getFirstPicked === "function")
		{
			const picked = c2Object.getFirstPicked();
			return picked ? [picked] : [];
		}

		// Some runtimes only expose object classes (no SOL methods on this object param).
		if (typeof this._getInstancesOf === "function")
		{
			const directInstances = this._getInstancesOf(c2Object);
			if (Array.isArray(directInstances) && directInstances.length)
			{
				return directInstances;
			}
		}

		const objectClass = (typeof c2Object.GetObjectClass === "function")
			? c2Object.GetObjectClass()
			: (typeof c2Object.getObjectClass === "function")
				? c2Object.getObjectClass()
				: null;
		if (objectClass && typeof this._getInstancesOf === "function")
		{
			const classInstances = this._getInstancesOf(objectClass);
			if (Array.isArray(classInstances) && classInstances.length)
			{
				return classInstances;
			}
		}

		// If a concrete instance was passed, use it directly.
		if (typeof c2Object === "object")
		{
			return [c2Object];
		}

		return [];
	}

	_setC2ObjectToSpriterObject(c2Object, setType, spriterName)
	{
		const c2Instances = this._resolveC2Instances(c2Object);
		const objectName = normaliseSpriterObjectName(spriterName);
		this._objectsToSet.push({ c2Instances, objectName, setType, pin: false });
	}

	_pinC2ObjectToSpriterObject(c2Object, setType, spriterName)
	{
		const c2Instances = this._resolveC2Instances(c2Object);
		const objectName = normaliseSpriterObjectName(spriterName);
		this._objectsToSet.push({ c2Instances, objectName, setType, pin: true });
	}

	_unpinC2ObjectFromSpriterObject(c2Object, spriterName)
	{
		const queryName = normaliseSpriterObjectName(spriterName);
		const allObjs = queryName === "";
		for (let i = this._objectsToSet.length - 1; i >= 0; i--)
		{
			const instr = this._objectsToSet[i];
			if (instr.c2Instances.length > 0 &&
				instr.c2Instances[0].GetObjectClass() === c2Object &&
				(allObjs || instr.objectName === queryName))
			{
				this._objectsToSet.splice(i, 1);
			}
		}
	}

	_unpinAllFromSpriterObject(spriterName)
	{
		if (spriterName === "")
		{
			this._objectsToSet.length = 0;
		}
		else
		{
			for (let i = this._objectsToSet.length - 1; i >= 0; i--)
			{
				if (this._objectsToSet[i].objectName === spriterName)
				{
					this._objectsToSet.splice(i, 1);
				}
			}
		}
	}

	_applyPoseToInstances()
	{
		if (this.drawSelf) return;

		if (!this._nonSelfDrawDiagDone)
		{
			this._nonSelfDrawDiagDone = true;
			const mapKeys = Array.from(this._c2ObjectMap.keys());
			const poseNames = this._poseObjectStates.map(s => s.timelineName);
			const mapEntries = Array.from(this._c2ObjectMap.entries()).map(([k, v]) =>
				`${k} => inst=${v.inst ? "OK" : "NULL"}, type=${this._getObjectTypeName(v.type)}`
			);
			console.log(`[Spriter] NON-SELF-DRAW DIAG: drawSelf=${this.drawSelf}, mapSize=${this._c2ObjectMap.size}, poseCount=${this._poseObjectStates.length}`);
			console.log(`[Spriter]   map keys: [${mapKeys.join(", ")}]`);
			console.log(`[Spriter]   map entries: [${mapEntries.join(" | ")}]`);
			console.log(`[Spriter]   pose timelineNames: [${poseNames.join(", ")}]`);

			for (const name of poseNames)
			{
				if (!this._c2ObjectMap.has(name))
				{
					console.warn(`[Spriter]   MISMATCH: pose timelineName '${name}' not found in c2ObjectMap`);
				}
			}
		}

		if (!this._c2ObjectMap.size) return;

		const poseObjects = this._poseObjectStates;
		if (!poseObjects.length) return;

		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo)
		{
			if (!this._diagWiWarnDone) { this._diagWiWarnDone = true; console.warn("[Spriter] _applyPoseToInstances: worldInfo for self is NULL, bailing"); }
			return;
		}

		const myX = worldInfo.GetX();
		const myY = worldInfo.GetY();
		const myAngle = worldInfo.GetAngle();
		const myVisible = worldInfo.IsVisible();
		const globalScale = toFiniteNumber(this._globalScaleRatio, 1);
		const mirrorFactor = this._xFlip ? -1 : 1;
		const flipFactor = this._yFlip ? -1 : 1;
		const rootFlipSign = mirrorFactor * flipFactor;

		// Per-tick diagnostic (every 60 frames)
		this._diagTickCount = (this._diagTickCount || 0) + 1;
		const doTickLog = (this._diagTickCount % 60 === 1);

		if (doTickLog)
		{
			const s0 = poseObjects[0];
			const sx = s0 && s0.x != null ? s0.x.toFixed(1) : "?";
			const sy = s0 && s0.y != null ? s0.y.toFixed(1) : "?";
			const sa = s0 && s0.angle != null ? s0.angle.toFixed(3) : "?";
			const t = this.localTimeMs != null ? this.localTimeMs.toFixed(1) : "?";
			console.log(`[Spriter] tick#${this._diagTickCount}: myPos=(${myX},${myY}), poseCount=${poseObjects.length}, sample[0]: name=${s0 ? s0.timelineName : "?"}, x=${sx}, y=${sy}, angle=${sa}, time=${t}ms`);
		}

		let previousZInst = null; // null = skip first z-order (can't pass SDK inst to moveAdjacentToInstance)
		let appliedCount = 0;
		let skippedNoEntry = 0;
		let skippedNoWi = 0;

		for (const state of poseObjects)
		{
			const c2Entry = this._c2ObjectMap.get(state.timelineName);
			if (!c2Entry || !c2Entry.inst) { skippedNoEntry++; continue; }

			const inst = c2Entry.inst;
			const wi = this._getWorldInfoOf(inst);
			if (!wi) { skippedNoWi++; continue; }

			appliedCount++;

			// Non-self-draw sprite swapping: map Spriter (folder,file) to child sprite frame index.
			const targetFrame = this._resolveFrameIndexForState(c2Entry, state);
			if (targetFrame >= 0 && c2Entry.lastAppliedFrame !== targetFrame)
			{
				if (this._setSpriteFrameByIndex(inst, targetFrame))
				{
					c2Entry.lastAppliedFrame = targetFrame;
				}
			}

			// Visibility
			if (this.setVisibilityForObjects)
				wi.SetVisible(myVisible);

			// Collision
			if (this.setCollisionsForObjects)
				wi.SetCollisionEnabled(true);

			// Apply parent/root angle in non-self-draw mode (legacy behaviour).
			const finalAngle = (rootFlipSign < 0)
				? ((Math.PI * 2) - state.angle) + myAngle
				: state.angle + myAngle;
			wi.SetAngle(finalAngle);

			// Opacity
			wi.SetOpacity(state.alpha);

			// Position: state.x/y are world-space offsets from the Spriter origin
			const cosA = Math.cos(myAngle);
			const sinA = Math.sin(myAngle);
			const localX = state.x * globalScale * mirrorFactor;
			const localY = state.y * globalScale * flipFactor;
			const finalX = myX + localX * cosA - localY * sinA;
			const finalY = myY + localX * sinA + localY * cosA;

			wi.SetOriginX(0);
			wi.SetOriginY(0);
			wi.SetX(finalX);
			wi.SetY(finalY);

			if (doTickLog && appliedCount === 1)
			{
				console.log(`[Spriter]   applied[0]: ${state.timelineName} -> finalPos=(${finalX.toFixed(1)},${finalY.toFixed(1)}), wiMethods=[SetX=${typeof wi.SetX},SetAngle=${typeof wi.SetAngle},SetBboxChanged=${typeof wi.SetBboxChanged}]`);
			}

			// Size (apply scale to original image dimensions)
			const trueW = state.width || 1;
			const trueH = state.height || 1;
			const newW = trueW * state.scaleX * globalScale * mirrorFactor;
			const newH = trueH * state.scaleY * globalScale * flipFactor;
			wi.SetWidth(newW);
			wi.SetHeight(newH);

			// Pivot offset
			this._applyPivotToInst(wi, state.pivotX, state.pivotY, newW, newH);

			// Z-ordering
			if (this.setLayersForSprites && previousZInst)
			{
				wi.ZOrderMoveAdjacentToInstance(previousZInst, true);
			}
			previousZInst = inst;

			wi.SetBboxChanged();
		}

		if (doTickLog)
		{
			console.log(`[Spriter]   tick#${this._diagTickCount} summary: applied=${appliedCount}, skippedNoEntry=${skippedNoEntry}, skippedNoWi=${skippedNoWi}`);
		}
	}

	_applyPivotToInst(wi, pivotX, pivotY, objWidth, objHeight)
	{
		const x = -pivotX * objWidth;
		const y = -pivotY * objHeight;
		const angle = wi.GetAngle();
		let s = 0, c = 1;
		if (angle !== 0)
		{
			s = Math.sin(angle);
			c = Math.cos(angle);
		}
		wi.SetX(wi.GetX() + x * c - y * s);
		wi.SetY(wi.GetY() + x * s + y * c);
	}

	_applyObjectsToSet()
	{
		for (let i = this._objectsToSet.length - 1; i >= 0; i--)
		{
			const instr = this._objectsToSet[i];
			const state = this._findPoseStateByTimelineName(instr.objectName);
			if (!state) continue;
			const worldState = this._getPoseStateWorldTransform(state);
			if (!worldState) continue;

			for (const c2Inst of instr.c2Instances)
			{
				if (!c2Inst) continue;
				const wi = this._getWorldInfoOf(c2Inst);
				if (!wi) continue;

				// setType: 0=angle+position, 1=angle, 2=position
				if (instr.setType === 0 || instr.setType === 1)
					wi.SetAngle(worldState.angle);

				if (instr.setType === 0 || instr.setType === 2)
				{
					wi.SetX(worldState.x);
					wi.SetY(worldState.y);
				}
				wi.SetBboxChanged();
			}

			if (!instr.pin)
			{
				this._objectsToSet.splice(i, 1);
			}
		}
	}

	_findPoseStateByTimelineName(name)
	{
		const queryNameRaw = normaliseSpriterObjectName(name);
		const queryName = stripEntityPrefix(
			queryNameRaw,
			this.entity && typeof this.entity.name === "string" ? this.entity.name : ""
		).trim();
		if (!queryName)
		{
			return null;
		}

		for (const state of this._poseObjectStates)
		{
			if (state && state.timelineName === queryName)
			{
				return state;
			}
		}

		const queryLower = toLowerCaseSafe(queryName);
		if (!queryLower)
		{
			return null;
		}

		for (const state of this._poseObjectStates)
		{
			if (toLowerCaseSafe(state && state.timelineName) === queryLower)
			{
				return state;
			}
		}

		return null;
	}

	_objectExists(name)
	{
		return !!this._findPoseStateByTimelineName(name);
	}

	_actionPointExists(name)
	{
		return this._objectExists(name);
	}

	_getPoseStateWorldTransform(state)
	{
		if (!state)
		{
			return null;
		}

		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo)
		{
			return {
				x: toFiniteNumber(state.x, 0),
				y: toFiniteNumber(state.y, 0),
				angle: toFiniteNumber(state.angle, 0)
			};
		}

		const myX = toFiniteNumber(callFirstMethod(worldInfo, ["GetX", "getX"]), 0);
		const myY = toFiniteNumber(callFirstMethod(worldInfo, ["GetY", "getY"]), 0);
		const myAngle = toFiniteNumber(callFirstMethod(worldInfo, ["GetAngle", "getAngle"]), 0);
		const cosA = Math.cos(myAngle);
		const sinA = Math.sin(myAngle);
		const globalScale = toFiniteNumber(this._globalScaleRatio, 1);
		const mirrorFactor = this._xFlip ? -1 : 1;
		const flipFactor = this._yFlip ? -1 : 1;
		const rootFlipSign = mirrorFactor * flipFactor;
		const localX = toFiniteNumber(state.x, 0) * globalScale * mirrorFactor;
		const localY = toFiniteNumber(state.y, 0) * globalScale * flipFactor;
		const worldX = myX + localX * cosA - localY * sinA;
		const worldY = myY + localX * sinA + localY * cosA;
		const worldAngle = (rootFlipSign < 0)
			? ((Math.PI * 2) - toFiniteNumber(state.angle, 0)) + myAngle
			: toFiniteNumber(state.angle, 0) + myAngle;

		return {
			x: worldX,
			y: worldY,
			angle: worldAngle
		};
	}

	_getPoseObjectX(name)
	{
		const state = this._findPoseStateByTimelineName(name);
		const worldState = this._getPoseStateWorldTransform(state);
		return worldState ? toFiniteNumber(worldState.x, 0) : 0;
	}

	_getPoseObjectY(name)
	{
		const state = this._findPoseStateByTimelineName(name);
		const worldState = this._getPoseStateWorldTransform(state);
		return worldState ? toFiniteNumber(worldState.y, 0) : 0;
	}

	_getPoseObjectAngleDegrees(name)
	{
		const state = this._findPoseStateByTimelineName(name);
		const worldState = this._getPoseStateWorldTransform(state);
		return worldState ? radiansToDegrees(worldState.angle) : 0;
	}

	_getSecondAnimationName()
	{
		const animation = this.secondAnimation;
		return animation && typeof animation.name === "string" ? animation.name : "";
	}

	_getWorldOpacityPercent()
	{
		const worldInfo = this._getWorldInfoOf(this);
		const opacity = toFiniteNumber(callFirstMethod(worldInfo, ["GetOpacity", "getOpacity"]), 1);
		return clamp(opacity * 100, 0, 100);
	}

	_getWorldZElevation(includeTotal = false)
	{
		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo)
		{
			return 0;
		}

		const methodNames = includeTotal
			? ["GetTotalZElevation", "getTotalZElevation"]
			: ["GetZElevation", "getZElevation"];
		return toFiniteNumber(callFirstMethod(worldInfo, methodNames), 0);
	}

	_getWorldBoundingRect()
	{
		const worldInfo = this._getWorldInfoOf(this);
		if (!worldInfo)
		{
			return {
				left: 0,
				top: 0,
				right: 0,
				bottom: 0
			};
		}

		const bbox = callFirstMethod(worldInfo, ["GetBoundingBox", "getBoundingBox"]);
		if (bbox)
		{
			const left = toFiniteNumber(callFirstMethod(bbox, ["GetLeft", "getLeft"]), toFiniteNumber(bbox.left, NaN));
			const top = toFiniteNumber(callFirstMethod(bbox, ["GetTop", "getTop"]), toFiniteNumber(bbox.top, NaN));
			const right = toFiniteNumber(callFirstMethod(bbox, ["GetRight", "getRight"]), toFiniteNumber(bbox.right, NaN));
			const bottom = toFiniteNumber(callFirstMethod(bbox, ["GetBottom", "getBottom"]), toFiniteNumber(bbox.bottom, NaN));
			if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(right) && Number.isFinite(bottom))
			{
				return { left, top, right, bottom };
			}
		}

		const x = toFiniteNumber(callFirstMethod(worldInfo, ["GetX", "getX"]), 0);
		const y = toFiniteNumber(callFirstMethod(worldInfo, ["GetY", "getY"]), 0);
		const width = Math.abs(toFiniteNumber(callFirstMethod(worldInfo, ["GetWidth", "getWidth"]), 0));
		const height = Math.abs(toFiniteNumber(callFirstMethod(worldInfo, ["GetHeight", "getHeight"]), 0));
		const halfW = width * 0.5;
		const halfH = height * 0.5;

		return {
			left: x - halfW,
			top: y - halfH,
			right: x + halfW,
			bottom: y + halfH
		};
	}

	// ───── End non-self-draw infrastructure ─────

	_saveToJson()
	{
		return {
			// data to be saved for savegames
		};
	}
	
	_loadFromJson(o)
	{
		// load state for savegames
	}
};
