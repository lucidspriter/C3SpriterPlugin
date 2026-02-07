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

function combineTransforms(parent, child)
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
	BLEND_MODE: 6,
	DRAW_DEBUG: 7
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
		this._poseBoneStates = [];
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
		this.setLayersForSprites = true;
		this.setVisibilityForObjects = true;
		this.setCollisionsForObjects = true;

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
			this._advanceTime(dtSeconds);
		}

		this._evaluatePose();

		if (!this.drawSelf)
		{
			this._applyPoseToInstances();
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

		const rootTransform = {
			x: instX,
			y: instY,
			angle: Number.isFinite(instAngle) ? instAngle : 0,
			scaleX: 1,
			scaleY: 1,
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
		// Avoid giant steps when the tab is backgrounded.
		return dt > 0 && dt < 0.5 ? dt : 0;
	}

	_advanceTime(dtSeconds)
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
			while (this.localTimeMs < 0)
			{
				this.localTimeMs += lengthMs;
			}

			// Preserve the legacy edge case where an exact endpoint time can be sampled.
			if (this.localTimeMs !== lengthMs)
			{
				this.localTimeMs %= lengthMs;
			}

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

	_isAnimationLooping(animation)
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

		// Spriter defaults to looping when the attribute is omitted.
		return true;
	}

	_evaluatePose()
	{
		const animation = this.animation;
		const projectData = this.projectData;
		if (!animation || !projectData)
		{
			this._poseObjectStates.length = 0;
			this._poseBoneStates.length = 0;
			return;
		}

		const mainline = animation.mainline;
		const keys = mainline && Array.isArray(mainline.key) ? mainline.key : [];
		if (!keys.length)
		{
			this._poseObjectStates.length = 0;
			this._poseBoneStates.length = 0;
			return;
		}

		const timeMs = this.localTimeMs;
		const mainKeyIndex = this._findKeyIndexForTime(keys, timeMs);
		const mainKey = keys[mainKeyIndex];
		if (!mainKey)
		{
			this._poseObjectStates.length = 0;
			this._poseBoneStates.length = 0;
			return;
		}

		const poseTimeMs = this._getMainlineAdjustedTime(keys, mainKeyIndex, timeMs);

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

		const poseBones = this._poseBoneStates;
		poseBones.length = 0;
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

			poseBones.push({
				id,
				parentId: toFiniteNumber(boneRef.parent, NaN),
				x: toFiniteNumber(world.x, 0),
				y: toFiniteNumber(world.y, 0),
				alpha: toFiniteNumber(world.alpha, 1)
			});
		}

		const poseObjects = this._poseObjectStates;
		poseObjects.length = 0;

		for (const objectRef of objectRefs)
		{
			const state = this._evaluateObjectRef(objectRef, poseTimeMs, boneRefsById, boneWorldById);
			if (state)
			{
				poseObjects.push(state);
			}
		}

		poseObjects.sort((a, b) => a.zIndex - b.zIndex);
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

	_resolveBoneTransform(boneRef, timeMs, boneRefsById, boneWorldById)
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
			name: fileInfo ? fileInfo.name : "",
			timelineName: this._timelineNameById.get(timelineId) || "",
			atlasIndex: fileInfo ? toFiniteNumber(fileInfo.atlasIndex, 0) : 0,
			atlasW: fileInfo ? toFiniteNumber(fileInfo.atlasW, 0) : 0,
			atlasH: fileInfo ? toFiniteNumber(fileInfo.atlasH, 0) : 0,
			atlasX: fileInfo ? toFiniteNumber(fileInfo.atlasX, 0) : 0,
			atlasY: fileInfo ? toFiniteNumber(fileInfo.atlasY, 0) : 0,
			atlasXOff: fileInfo ? toFiniteNumber(fileInfo.atlasXOff, 0) : 0,
			atlasYOff: fileInfo ? toFiniteNumber(fileInfo.atlasYOff, 0) : 0,
			atlasRotated: fileInfo ? !!fileInfo.atlasRotated : false
		};
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

		this.localTimeMs = 0;
		this.playing = true;
		this._lastTickTimeSec = null;

		this._buildObjectArray();

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

		this._timelineById.clear();
		this._timelineNameById.clear();
		const entityNamePrefix = entity.name ? entity.name + "_" : "";
		const timelines = Array.isArray(animation.timeline) ? animation.timeline : [];
		for (let i = 0; i < timelines.length; i++)
		{
			const timeline = timelines[i];
			const id = toFiniteNumber(timeline && timeline.id, i);
			this._timelineById.set(id, timeline);
			let tlName = timeline && timeline.name ? timeline.name : "";
			if (entityNamePrefix && tlName.startsWith(entityNamePrefix))
			{
				tlName = tlName.slice(entityNamePrefix.length);
			}
			this._timelineNameById.set(id, tlName);
		}

		// Ensure we have an evaluated pose ready for the first draw.
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

	_associateTypeWithName(objectType, spriterName)
	{
		const myIID = this._getIID();
		const instances = this._getInstancesOf(objectType);
		const pairedInst = instances[myIID] || null;

		const apis = [
			typeof objectType.GetInstances === "function" ? "GetInstances" : null,
			typeof objectType.getAllInstances === "function" ? "getAllInstances" : null,
			typeof objectType.instances === "function" ? "instances" : null,
			Array.isArray(objectType._instances) ? "_instances" : null
		].filter(Boolean).join(",");
		console.log(`[Spriter] _associateTypeWithName: spriterName='${spriterName}', typeName='${this._getObjectTypeName(objectType)}', myIID=${myIID}, instanceCount=${instances.length}, pairedInst=${pairedInst ? "found" : "NULL"}, apis=[${apis}]`);

		this._c2ObjectMap.set(spriterName, {
			type: objectType,
			inst: pairedInst,
			spriterType: "sprite"
		});
	}

	_resolveC2Instances(c2Object)
	{
		const sol = c2Object.GetSolStack()._current;
		let instances = sol._instances;
		if (instances.length === 0 && sol._selectAll === true)
		{
			instances = c2Object._instances;
		}
		return Array.from(instances);
	}

	_setC2ObjectToSpriterObject(c2Object, setType, spriterName)
	{
		const c2Instances = this._resolveC2Instances(c2Object);
		this._objectsToSet.push({ c2Instances, objectName: spriterName, setType, pin: false });
	}

	_pinC2ObjectToSpriterObject(c2Object, setType, spriterName)
	{
		const c2Instances = this._resolveC2Instances(c2Object);
		this._objectsToSet.push({ c2Instances, objectName: spriterName, setType, pin: true });
	}

	_unpinC2ObjectFromSpriterObject(c2Object, spriterName)
	{
		const allObjs = spriterName === "";
		for (let i = this._objectsToSet.length - 1; i >= 0; i--)
		{
			const instr = this._objectsToSet[i];
			if (instr.c2Instances.length > 0 &&
				instr.c2Instances[0].GetObjectClass() === c2Object &&
				(allObjs || instr.objectName === spriterName))
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

			// Visibility
			if (this.setVisibilityForObjects)
				wi.SetVisible(myVisible);

			// Collision
			if (this.setCollisionsForObjects)
				wi.SetCollisionEnabled(true);

			// Angle (state.angle is already in radians from degreesToRadians)
			wi.SetAngle(state.angle);

			// Opacity
			wi.SetOpacity(state.alpha);

			// Position: state.x/y are world-space offsets from the Spriter origin
			const cosA = Math.cos(myAngle);
			const sinA = Math.sin(myAngle);
			const finalX = myX + state.x * cosA - state.y * sinA;
			const finalY = myY + state.x * sinA + state.y * cosA;

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
			const newW = trueW * state.scaleX;
			const newH = trueH * state.scaleY;
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

			for (const c2Inst of instr.c2Instances)
			{
				if (!c2Inst) continue;
				const wi = this._getWorldInfoOf(c2Inst);
				if (!wi) continue;

				// setType: 0=angle+position, 1=angle, 2=position
				if (instr.setType === 0 || instr.setType === 1)
					wi.SetAngle(state.angle);
				if (instr.setType === 0 || instr.setType === 2)
				{
					wi.SetX(state.x);
					wi.SetY(state.y);
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
		for (const state of this._poseObjectStates)
		{
			if (state.timelineName === name) return state;
		}
		return null;
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
