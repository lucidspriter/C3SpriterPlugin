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

function toFiniteNumber(value, defaultValue)
{
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : defaultValue;
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
	return degrees * (Math.PI / 180);
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
		this.startingEntityName = this.properties[PROPERTY_INDEX.STARTING_ENTITY];
		this.startingAnimationName = this.properties[PROPERTY_INDEX.STARTING_ANIMATION];
		this.startingOpacity = this.properties[PROPERTY_INDEX.STARTING_OPACITY];
		this.drawSelf = this.properties[PROPERTY_INDEX.DRAW_SELF] === 1;
		this.nicknameInC2 = this.properties[PROPERTY_INDEX.NICKNAME];
		this.noPremultiply = this.properties[PROPERTY_INDEX.BLEND_MODE] === 0;

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
	
	_draw(renderer)
	{
		if (!this.drawSelf || !renderer)
		{
			return;
		}

		const poseObjects = Array.isArray(this._poseObjectStates) ? this._poseObjectStates : [];
		if (!poseObjects.length)
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

		// Debug self-draw: draw solid coloured quads for each pose object so motion is visible.
		if (typeof renderer.SetColorFillMode === "function")
		{
			renderer.SetColorFillMode();
		}
		else if (typeof renderer.setColorFillMode === "function")
		{
			renderer.setColorFillMode();
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

		const quad3 = quad3C3 || quad3Dom;
		const quad = quadDom || quadC3;

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

			// Keep the rect dimensions positive; pivot flips keep the origin stable.
			if (scaleX < 0)
			{
				scaleX = -scaleX;
				pivotX = 1 - pivotX;
			}

			if (scaleY < 0)
			{
				scaleY = -scaleY;
				pivotY = 1 - pivotY;
			}

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

			if (setColorRgba)
			{
				// Deterministic colour per file/timeline so parts are visually distinct.
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
				// In case this runtime uses dom quads + rects.
				const domRect = { x: left, y: top, width: scaledW, height: scaledH };
				quad3Dom(domQuad, domRect);
			}
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

		poseObjects.sort((a, b) => a.zIndex - b.zIndex);
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
			name: fileInfo ? fileInfo.name : ""
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
