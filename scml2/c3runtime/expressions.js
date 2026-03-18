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
		const keyIndex = Number(this._currentMainlineKeyIndex);
		return Number.isFinite(keyIndex) ? keyIndex : 0;
	},

	TimeRatio()
	{
		return this._getCurrentTimeRatio();
	},

	// Legacy ACE alias used by older projects.
	timeRatio()
	{
		return this._getCurrentTimeRatio();
	},

	PlayTo()
	{
		const playTo = Number(this._playToTimeMs);
		return Number.isFinite(playTo) ? playTo : -1;
	},

	PlayToTimeLeft()
	{
		return this._getPlayToTimeLeftMs();
	},

	AnimationLength()
	{
		const lengthMs = Number(this.animationLengthMs);
		return Number.isFinite(lengthMs) ? lengthMs : 0;
	},

	// Legacy ACE alias used by older projects.
	animationLength()
	{
		const lengthMs = Number(this.animationLengthMs);
		return Number.isFinite(lengthMs) ? lengthMs : 0;
	},

	SpeedRatio()
	{
		const speed = Number(this.playbackSpeed);
		return Number.isFinite(speed) ? speed : 1;
	},

	// Legacy ACE alias used by older projects.
	speedRatio()
	{
		const speed = Number(this.playbackSpeed);
		return Number.isFinite(speed) ? speed : 1;
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
		const blend = Number(this.animBlend);
		return Number.isFinite(blend) ? blend : 0;
	},

	SecondAnimationName()
	{
		return this._getSecondAnimationName();
	},

	// Legacy ACE alias used by older projects.
	secondAnimationName()
	{
		return this._getSecondAnimationName();
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
		return this.lastFoundObject || "";
	},

	PointX(name)
	{
		return this._getPoseObjectX(name);
	},

	// Legacy ACE alias used by older projects.
	pointX(name)
	{
		return C3.Plugins.Spriter.Exps.PointX.call(this, name);
	},

	PointY(name)
	{
		return this._getPoseObjectY(name);
	},

	// Legacy ACE alias used by older projects.
	pointY(name)
	{
		return C3.Plugins.Spriter.Exps.PointY.call(this, name);
	},

	PointAngle(name)
	{
		return this._getPoseObjectAngleDegrees(name);
	},

	// Legacy ACE alias used by older projects.
	pointAngle(name)
	{
		return C3.Plugins.Spriter.Exps.PointAngle.call(this, name);
	},

	ObjectX(name)
	{
		return this._getPoseObjectX(name);
	},

	// Legacy ACE alias used by older projects.
	objectX(name)
	{
		return C3.Plugins.Spriter.Exps.ObjectX.call(this, name);
	},

	ObjectY(name)
	{
		return this._getPoseObjectY(name);
	},

	// Legacy ACE alias used by older projects.
	objectY(name)
	{
		return C3.Plugins.Spriter.Exps.ObjectY.call(this, name);
	},

	ObjectAngle(name)
	{
		return this._getPoseObjectAngleDegrees(name);
	},

	// Legacy ACE alias used by older projects.
	objectAngle(name)
	{
		return C3.Plugins.Spriter.Exps.ObjectAngle.call(this, name);
	},

	EntityName()
	{
		const entity = this.entity;
		return entity && typeof entity.name === "string" ? entity.name : "";
	},

	// Legacy ACE alias used by older projects.
	entityName()
	{
		const entity = this.entity;
		return entity && typeof entity.name === "string" ? entity.name : "";
	},

	AnimationName()
	{
		return this._getAnimationName();
	},

	// Legacy ACE alias used by older projects.
	animationName()
	{
		return this._getAnimationName();
	},

	TriggeredSound()
	{
		return this._triggeredSoundName || "";
	},

	// Legacy ACE alias used by older projects.
	triggeredSound()
	{
		return this._triggeredSoundName || "";
	},

	TriggeredSoundTag()
	{
		return this._triggeredSoundTag || "";
	},

	// Legacy ACE alias used by older projects.
	triggeredSoundTag()
	{
		return this._triggeredSoundTag || "";
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
		const key = typeof soundTag === "string" ? soundTag : String(soundTag ?? "");
		const state = this._soundStateByName && this._soundStateByName.get(key);
		const volume = state ? Number(state.volume) : NaN;
		return Number.isFinite(volume) ? volume : 0;
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
		const key = typeof soundTag === "string" ? soundTag : String(soundTag ?? "");
		const state = this._soundStateByName && this._soundStateByName.get(key);
		const panning = state ? Number(state.panning) : NaN;
		return Number.isFinite(panning) ? panning : 0;
	},

	GetOpacity()
	{
		return this._getWorldOpacityPercent();
	},

	// Legacy ACE alias used by older projects.
	Opacity()
	{
		return C3.Plugins.Spriter.Exps.GetOpacity.call(this);
	},

	BBoxLeft()
	{
		const rect = this._getWorldBoundingRect();
		return rect ? Number(rect.left) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxLeft()
	{
		return C3.Plugins.Spriter.Exps.BBoxLeft.call(this);
	},

	BBoxTop()
	{
		const rect = this._getWorldBoundingRect();
		return rect ? Number(rect.top) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxTop()
	{
		return C3.Plugins.Spriter.Exps.BBoxTop.call(this);
	},

	BBoxRight()
	{
		const rect = this._getWorldBoundingRect();
		return rect ? Number(rect.right) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxRight()
	{
		return C3.Plugins.Spriter.Exps.BBoxRight.call(this);
	},

	BBoxBottom()
	{
		const rect = this._getWorldBoundingRect();
		return rect ? Number(rect.bottom) || 0 : 0;
	},

	// Legacy ACE alias used by older projects.
	bboxBottom()
	{
		return C3.Plugins.Spriter.Exps.BBoxBottom.call(this);
	},

	ZElevation()
	{
		return this._getWorldZElevation(false);
	},

	TotalZElevation()
	{
		return this._getWorldZElevation(true);
	},

	val(varName, objectName = "")
	{
		return this._val(varName, objectName);
	},

	Val(varName, objectName = "")
	{
		return C3.Plugins.Spriter.Exps.val.call(this, varName, objectName);
	}
};
