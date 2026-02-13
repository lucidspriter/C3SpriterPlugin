const C3 = globalThis.C3;

C3.Plugins.Spriter.Acts =
{
	SetAnimation(animationName, startFrom = 0, blendDuration = 0)
	{
		if (typeof this._setAnimation === "function")
		{
			this._setAnimation(animationName, startFrom, blendDuration);
		}
	},

	// Legacy ACE alias used by older projects.
	setAnimation(animationName, startFrom = 0, blendDuration = 0)
	{
		this.SetAnimation(animationName, startFrom, blendDuration);
	},

	SetPlaybackSpeedRatio(newSpeed)
	{
		if (typeof this._setPlaybackSpeedRatio === "function")
		{
			this._setPlaybackSpeedRatio(newSpeed);
		}
	},

	// Legacy ACE alias used by older projects.
	setPlaybackSpeedRatio(newSpeed)
	{
		this.SetPlaybackSpeedRatio(newSpeed);
	},

	SetAnimationLoop(loopOn)
	{
		if (typeof this._setAnimationLoop === "function")
		{
			this._setAnimationLoop(loopOn);
		}
	},

	// Legacy ACE alias used by older projects.
	setAnimationLoop(loopOn)
	{
		this.SetAnimationLoop(loopOn);
	},

	SetAnimationTime(units, timeValue)
	{
		if (typeof this._setAnimationTime === "function")
		{
			this._setAnimationTime(units, timeValue);
		}
	},

	// Legacy ACE alias used by older projects.
	setAnimationTime(units, timeValue)
	{
		this.SetAnimationTime(units, timeValue);
	},

	PauseAnimation()
	{
		if (typeof this._pauseAnimation === "function")
		{
			this._pauseAnimation();
		}
	},

	// Legacy ACE alias used by older projects.
	pauseAnimation()
	{
		this.PauseAnimation();
	},

	ResumeAnimation()
	{
		if (typeof this._resumeAnimation === "function")
		{
			this._resumeAnimation();
		}
	},

	// Legacy ACE alias used by older projects.
	resumeAnimation()
	{
		this.ResumeAnimation();
	},

	PlayAnimTo(units, targetValue)
	{
		if (typeof this._playAnimTo === "function")
		{
			this._playAnimTo(units, targetValue);
		}
	},

	// Legacy ACE alias used by older projects.
	playAnimTo(units, targetValue)
	{
		this.PlayAnimTo(units, targetValue);
	},

	AssociateTypeWithName(objectType, name)
	{
		this._associateTypeWithName(objectType, name);
	},

	// Legacy ACE alias used by older projects.
	associateTypeWithName(objectType, name)
	{
		this._associateTypeWithName(objectType, name);
	},

	PinC3ObjectToSpriterObject(c3Object, setType, name)
	{
		this._pinC2ObjectToSpriterObject(c3Object, setType, name);
	},

	// Legacy ACE alias used by older projects.
	pinC2ObjectToSpriterObject(c2Object, setType, name)
	{
		this._pinC2ObjectToSpriterObject(c2Object, setType, name);
	},

	SetC3ObjectToSpriterObject(c3Object, setType, name)
	{
		this._setC2ObjectToSpriterObject(c3Object, setType, name);
	},

	// Legacy ACE alias used by older projects.
	setC2ObjectToSpriterObject(c2Object, setType, name)
	{
		this._setC2ObjectToSpriterObject(c2Object, setType, name);
	},

	UnpinC3ObjectFromSpriterObject(c3Object, name)
	{
		this._unpinC2ObjectFromSpriterObject(c3Object, name);
	},

	// Legacy ACE alias used by older projects.
	unpinC2ObjectFromSpriterObject(c2Object, name)
	{
		this._unpinC2ObjectFromSpriterObject(c2Object, name);
	},

	UnpinAllFromSpriterObject(name)
	{
		this._unpinAllFromSpriterObject(name);
	},

	// Legacy ACE alias used by older projects.
	unpinAllFromSpriterObject(name)
	{
		this._unpinAllFromSpriterObject(name);
	}
};
