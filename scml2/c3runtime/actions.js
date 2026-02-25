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
		C3.Plugins.Spriter.Acts.SetAnimation.call(this, animationName, startFrom, blendDuration);
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
		C3.Plugins.Spriter.Acts.SetPlaybackSpeedRatio.call(this, newSpeed);
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
		C3.Plugins.Spriter.Acts.SetAnimationLoop.call(this, loopOn);
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
		C3.Plugins.Spriter.Acts.SetAnimationTime.call(this, units, timeValue);
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
		C3.Plugins.Spriter.Acts.PauseAnimation.call(this);
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
		C3.Plugins.Spriter.Acts.ResumeAnimation.call(this);
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
		C3.Plugins.Spriter.Acts.PlayAnimTo.call(this, units, targetValue);
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
		C3.Plugins.Spriter.Acts.SetEntity.call(this, entityName, animationName);
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
		C3.Plugins.Spriter.Acts.SetObjectScaleRatio.call(this, scaleRatio, xFlip, yFlip);
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
		C3.Plugins.Spriter.Acts.SetObjectXFlip.call(this, xFlip);
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
		C3.Plugins.Spriter.Acts.SetObjectYFlip.call(this, yFlip);
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
		C3.Plugins.Spriter.Acts.SetIgnoreGlobalTimeScale.call(this, ignore);
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
		C3.Plugins.Spriter.Acts.SetAutomaticPausing.call(this, newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer);
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
		C3.Plugins.Spriter.Acts.StopResumeSettingLayer.call(this, resume);
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
		C3.Plugins.Spriter.Acts.StopResumeSettingVisibilityForObjects.call(this, resume);
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
		C3.Plugins.Spriter.Acts.StopResumeSettingCollisionsForObjects.call(this, resume);
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
		C3.Plugins.Spriter.Acts.SetVisible.call(this, visible);
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
		C3.Plugins.Spriter.Acts.SetOpacity.call(this, opacityPercent);
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
		C3.Plugins.Spriter.Acts.SetSecondAnim.call(this, animationName);
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
		C3.Plugins.Spriter.Acts.StopSecondAnim.call(this);
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
		C3.Plugins.Spriter.Acts.AppendCharMap.call(this, mapName);
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
		C3.Plugins.Spriter.Acts.RemoveCharMap.call(this, mapName);
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
		C3.Plugins.Spriter.Acts.RemoveAllCharMaps.call(this);
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
		C3.Plugins.Spriter.Acts.OverrideObjectComponent.call(this, objectName, component, newValue);
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
		C3.Plugins.Spriter.Acts.OverrideBonesWithIk.call(this, parentBoneName, childBoneName, targetX, targetY, additionalLength);
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
		C3.Plugins.Spriter.Acts.SetAnimBlendRatio.call(this, blendRatio);
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
		C3.Plugins.Spriter.Acts.SetZElevation.call(this, zElevation);
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
		C3.Plugins.Spriter.Acts.FindSpriterObject.call(this, c2Object);
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
