const C3 = globalThis.C3;

C3.Plugins.Spriter.Exps =
{
	LastError()
	{
		return this.loadErrorMessage || "";
	},

	Time()
	{
		const timeMs = Number(this.localTimeMs);
		return Number.isFinite(timeMs) ? timeMs / 1000 : 0;
	},

	// Legacy ACE alias used by older projects.
	time()
	{
		const timeMs = Number(this.localTimeMs);
		return Number.isFinite(timeMs) ? timeMs : 0;
	},

	Key()
	{
		const keyIndex = Number(this._currentMainlineKeyIndex);
		return Number.isFinite(keyIndex) ? keyIndex : 0;
	},

	// Legacy ACE alias used by older projects.
	key()
	{
		return this.Key();
	},

	TimeRatio()
	{
		return (typeof this._getCurrentTimeRatio === "function")
			? this._getCurrentTimeRatio()
			: 0;
	},

	// Legacy ACE alias used by older projects.
	timeRatio()
	{
		return this.TimeRatio();
	},

	PlayTo()
	{
		const playTo = Number(this._playToTimeMs);
		return Number.isFinite(playTo) ? playTo : -1;
	},

	PlayToTimeLeft()
	{
		return (typeof this._getPlayToTimeLeftMs === "function")
			? this._getPlayToTimeLeftMs()
			: 0;
	},

	AnimationLength()
	{
		const lengthMs = Number(this.animationLengthMs);
		return Number.isFinite(lengthMs) ? lengthMs : 0;
	},

	// Legacy ACE alias used by older projects.
	animationLength()
	{
		return this.AnimationLength();
	},

	SpeedRatio()
	{
		const speed = Number(this.playbackSpeed);
		return Number.isFinite(speed) ? speed : 1;
	},

	// Legacy ACE alias used by older projects.
	speedRatio()
	{
		return this.SpeedRatio();
	},

	ScaleRatio()
	{
		const scale = Number(this._globalScaleRatio);
		return Number.isFinite(scale) ? scale : 1;
	},

	BlendRatio()
	{
		const blend = Number(this.animBlend);
		return Number.isFinite(blend) ? blend : 0;
	},

	// Legacy ACE alias used by older projects.
	blendRatio()
	{
		return this.BlendRatio();
	},

	SecondAnimationName()
	{
		return (typeof this._getSecondAnimationName === "function")
			? this._getSecondAnimationName()
			: "";
	},

	// Legacy ACE alias used by older projects.
	secondAnimationName()
	{
		return this.SecondAnimationName();
	},

	ObjectCount()
	{
		const states = this._poseObjectStates;
		return Array.isArray(states) ? states.length : 0;
	},

	FoundObject()
	{
		return this.lastFoundObject || "";
	},

	// Legacy ACE alias used by older projects.
	foundObject()
	{
		return this.FoundObject();
	},

	PointX(name)
	{
		return (typeof this._getPoseObjectX === "function")
			? this._getPoseObjectX(name)
			: 0;
	},

	// Legacy ACE alias used by older projects.
	pointX(name)
	{
		return this.PointX(name);
	},

	PointY(name)
	{
		return (typeof this._getPoseObjectY === "function")
			? this._getPoseObjectY(name)
			: 0;
	},

	// Legacy ACE alias used by older projects.
	pointY(name)
	{
		return this.PointY(name);
	},

	PointAngle(name)
	{
		return (typeof this._getPoseObjectAngleDegrees === "function")
			? this._getPoseObjectAngleDegrees(name)
			: 0;
	},

	// Legacy ACE alias used by older projects.
	pointAngle(name)
	{
		return this.PointAngle(name);
	},

	ObjectX(name)
	{
		return this.PointX(name);
	},

	// Legacy ACE alias used by older projects.
	objectX(name)
	{
		return this.ObjectX(name);
	},

	ObjectY(name)
	{
		return this.PointY(name);
	},

	// Legacy ACE alias used by older projects.
	objectY(name)
	{
		return this.ObjectY(name);
	},

	ObjectAngle(name)
	{
		return this.PointAngle(name);
	},

	// Legacy ACE alias used by older projects.
	objectAngle(name)
	{
		return this.ObjectAngle(name);
	},

	EntityName()
	{
		const entity = this.entity;
		return entity && typeof entity.name === "string" ? entity.name : "";
	},

	// Legacy ACE alias used by older projects.
	entityName()
	{
		return this.EntityName();
	},

	AnimationName()
	{
		const animation = this.animation;
		return animation && typeof animation.name === "string" ? animation.name : "";
	},

	// Legacy ACE alias used by older projects.
	animationName()
	{
		return this.AnimationName();
	},

	TriggeredSound()
	{
		return this._triggeredSoundName || "";
	},

	// Legacy ACE alias used by older projects.
	triggeredSound()
	{
		return this.TriggeredSound();
	},

	TriggeredSoundTag()
	{
		return this._triggeredSoundTag || "";
	},

	// Legacy ACE alias used by older projects.
	triggeredSoundTag()
	{
		return this.TriggeredSoundTag();
	},

	SoundVolume(soundTag)
	{
		const key = typeof soundTag === "string" ? soundTag : String(soundTag ?? "");
		const state = this._soundStateByName && this._soundStateByName.get(key);
		const volume = state ? Number(state.volume) : NaN;
		return Number.isFinite(volume) ? volume : 0;
	},

	// Legacy ACE alias used by older projects.
	soundVolume(soundTag)
	{
		return this.SoundVolume(soundTag);
	},

	SoundPanning(soundTag)
	{
		const key = typeof soundTag === "string" ? soundTag : String(soundTag ?? "");
		const state = this._soundStateByName && this._soundStateByName.get(key);
		const panning = state ? Number(state.panning) : NaN;
		return Number.isFinite(panning) ? panning : 0;
	},

	// Legacy ACE alias used by older projects.
	soundPanning(soundTag)
	{
		return this.SoundPanning(soundTag);
	},

	GetOpacity()
	{
		return (typeof this._getWorldOpacityPercent === "function")
			? this._getWorldOpacityPercent()
			: 0;
	},

	// Legacy ACE alias used by older projects.
	Opacity()
	{
		return this.GetOpacity();
	},

	BBoxLeft()
	{
		const rect = (typeof this._getWorldBoundingRect === "function")
			? this._getWorldBoundingRect()
			: null;
		return rect ? Number(rect.left) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxLeft()
	{
		return this.BBoxLeft();
	},

	BBoxTop()
	{
		const rect = (typeof this._getWorldBoundingRect === "function")
			? this._getWorldBoundingRect()
			: null;
		return rect ? Number(rect.top) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxTop()
	{
		return this.BBoxTop();
	},

	BBoxRight()
	{
		const rect = (typeof this._getWorldBoundingRect === "function")
			? this._getWorldBoundingRect()
			: null;
		return rect ? Number(rect.right) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxRight()
	{
		return this.BBoxRight();
	},

	BBoxBottom()
	{
		const rect = (typeof this._getWorldBoundingRect === "function")
			? this._getWorldBoundingRect()
			: null;
		return rect ? Number(rect.bottom) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxBottom()
	{
		return this.BBoxBottom();
	},

	ZElevation()
	{
		return (typeof this._getWorldZElevation === "function")
			? this._getWorldZElevation(false)
			: 0;
	},

	TotalZElevation()
	{
		return (typeof this._getWorldZElevation === "function")
			? this._getWorldZElevation(true)
			: 0;
	}
};
