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

	SetEntity(entityName, animationName)
	{
		if (typeof this._setEnt === "function")
		{
			this._setEnt(entityName, animationName);
		}
	},

	// Legacy ACE alias used by older projects.
	setEnt(entityName, animationName)
	{
		this.SetEntity(entityName, animationName);
	},

	SetObjectScaleRatio(scaleRatio, xFlip, yFlip)
	{
		if (typeof this._setObjectScaleRatio === "function")
		{
			this._setObjectScaleRatio(scaleRatio, xFlip, yFlip);
		}
	},

	// Legacy ACE alias used by older projects.
	setObjectScaleRatio(scaleRatio, xFlip, yFlip)
	{
		this.SetObjectScaleRatio(scaleRatio, xFlip, yFlip);
	},

	SetObjectXFlip(xFlip)
	{
		if (typeof this._setObjectXFlip === "function")
		{
			this._setObjectXFlip(xFlip);
		}
	},

	// Legacy ACE alias used by older projects.
	setObjectXFlip(xFlip)
	{
		this.SetObjectXFlip(xFlip);
	},

	SetObjectYFlip(yFlip)
	{
		if (typeof this._setObjectYFlip === "function")
		{
			this._setObjectYFlip(yFlip);
		}
	},

	// Legacy ACE alias used by older projects.
	setObjectYFlip(yFlip)
	{
		this.SetObjectYFlip(yFlip);
	},

	SetIgnoreGlobalTimeScale(ignore)
	{
		if (typeof this._setIgnoreGlobalTimeScale === "function")
		{
			this._setIgnoreGlobalTimeScale(ignore);
		}
	},

	// Legacy ACE alias used by older projects.
	setIgnoreGlobalTimeScale(ignore)
	{
		this.SetIgnoreGlobalTimeScale(ignore);
	},

	SetAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer)
	{
		if (typeof this._setAutomaticPausing === "function")
		{
			this._setAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer);
		}
	},

	// Legacy ACE alias used by older projects.
	setAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer)
	{
		this.SetAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer);
	},

	StopResumeSettingLayer(resume)
	{
		if (typeof this._stopResumeSettingLayer === "function")
		{
			this._stopResumeSettingLayer(resume);
		}
	},

	// Legacy ACE alias used by older projects.
	stopResumeSettingLayer(resume)
	{
		this.StopResumeSettingLayer(resume);
	},

	StopResumeSettingVisibilityForObjects(resume)
	{
		if (typeof this._stopResumeSettingVisibilityForObjects === "function")
		{
			this._stopResumeSettingVisibilityForObjects(resume);
		}
	},

	// Legacy ACE alias used by older projects.
	stopResumeSettingVisibilityForObjects(resume)
	{
		this.StopResumeSettingVisibilityForObjects(resume);
	},

	StopResumeSettingCollisionsForObjects(resume)
	{
		if (typeof this._stopResumeSettingCollisionsForObjects === "function")
		{
			this._stopResumeSettingCollisionsForObjects(resume);
		}
	},

	// Legacy ACE alias used by older projects.
	stopResumeSettingCollisionsForObjects(resume)
	{
		this.StopResumeSettingCollisionsForObjects(resume);
	},

	SetVisible(visible)
	{
		if (typeof this._setVisible === "function")
		{
			this._setVisible(visible);
		}
	},

	// Legacy ACE alias used by older projects.
	setVisible(visible)
	{
		this.SetVisible(visible);
	},

	SetOpacity(opacityPercent)
	{
		if (typeof this._setOpacity === "function")
		{
			this._setOpacity(opacityPercent);
		}
	},

	// Legacy ACE alias used by older projects.
	setOpacity(opacityPercent)
	{
		this.SetOpacity(opacityPercent);
	},

	SetSecondAnim(animationName)
	{
		if (typeof this._setSecondAnim === "function")
		{
			this._setSecondAnim(animationName);
		}
	},

	// Legacy ACE alias used by older projects.
	setSecondAnim(animationName)
	{
		this.SetSecondAnim(animationName);
	},

	StopSecondAnim()
	{
		if (typeof this._stopSecondAnim === "function")
		{
			this._stopSecondAnim();
		}
	},

	// Legacy ACE alias used by older projects.
	stopSecondAnim()
	{
		this.StopSecondAnim();
	},

	AppendCharMap(mapName)
	{
		if (typeof this._appendCharMap === "function")
		{
			this._appendCharMap(mapName);
		}
	},

	// Legacy ACE alias used by older projects.
	appendCharMap(mapName)
	{
		this.AppendCharMap(mapName);
	},

	RemoveCharMap(mapName)
	{
		if (typeof this._removeCharMap === "function")
		{
			this._removeCharMap(mapName);
		}
	},

	// Legacy ACE alias used by older projects.
	removeCharMap(mapName)
	{
		this.RemoveCharMap(mapName);
	},

	RemoveAllCharMaps()
	{
		if (typeof this._removeAllCharMaps === "function")
		{
			this._removeAllCharMaps();
		}
	},

	// Legacy ACE alias used by older projects.
	removeAllCharMaps()
	{
		this.RemoveAllCharMaps();
	},

	OverrideObjectComponent(objectName, component, newValue)
	{
		if (typeof this._overrideObjectComponent === "function")
		{
			this._overrideObjectComponent(objectName, component, newValue);
		}
	},

	// Legacy ACE alias used by older projects.
	overrideObjectComponent(objectName, component, newValue)
	{
		this.OverrideObjectComponent(objectName, component, newValue);
	},

	OverrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength)
	{
		if (typeof this._overrideBonesWithIk === "function")
		{
			this._overrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength);
		}
	},

	// Legacy ACE alias used by older projects.
	overrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength)
	{
		this.OverrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength);
	},

	SetAnimBlendRatio(blendRatio)
	{
		if (typeof this._setAnimBlendRatio === "function")
		{
			this._setAnimBlendRatio(blendRatio);
		}
	},

	// Legacy ACE alias used by older projects.
	setAnimBlendRatio(blendRatio)
	{
		this.SetAnimBlendRatio(blendRatio);
	},

	SetZElevation(zElevation)
	{
		if (typeof this._setZElevation === "function")
		{
			this._setZElevation(zElevation);
		}
	},

	// Legacy ACE alias used by older projects.
	setZElevation(zElevation)
	{
		this.SetZElevation(zElevation);
	},

	loadFromURL(url, crossOrigin, sconText)
	{
		if (typeof this._loadFromURL === "function")
		{
			return this._loadFromURL(url, crossOrigin, sconText);
		}

		return undefined;
	},

	FindSpriterObject(c2Object)
	{
		if (typeof this._findSpriterObject === "function")
		{
			this._findSpriterObject(c2Object);
		}
	},

	// Legacy ACE alias used by older projects.
	findSpriterObject(c2Object)
	{
		this.FindSpriterObject(c2Object);
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
