const C3 = globalThis.C3;

C3.Plugins.Spriter.Acts =
{
	SetAnimation(animationName, startFrom = 0, blendDuration = 0)
	{
		this._setAnimation(animationName, startFrom, blendDuration);
	},

	// Legacy ACE alias used by older projects.
	setAnimation(animationName, startFrom = 0, blendDuration = 0)
	{
		C3.Plugins.Spriter.Acts.SetAnimation.call(this, animationName, startFrom, blendDuration);
	},

	SetPlaybackSpeedRatio(newSpeed)
	{
		this._setPlaybackSpeedRatio(newSpeed);
	},

	// Legacy ACE alias used by older projects.
	setPlaybackSpeedRatio(newSpeed)
	{
		C3.Plugins.Spriter.Acts.SetPlaybackSpeedRatio.call(this, newSpeed);
	},

	SetAnimationLoop(loopOn)
	{
		this._setAnimationLoop(loopOn);
	},

	// Legacy ACE alias used by older projects.
	setAnimationLoop(loopOn)
	{
		C3.Plugins.Spriter.Acts.SetAnimationLoop.call(this, loopOn);
	},

	SetAnimationTime(units, timeValue)
	{
		this._setAnimationTime(units, timeValue);
	},

	// Legacy ACE alias used by older projects.
	setAnimationTime(units, timeValue)
	{
		C3.Plugins.Spriter.Acts.SetAnimationTime.call(this, units, timeValue);
	},

	PauseAnimation()
	{
		this._pauseAnimation();
	},

	// Legacy ACE alias used by older projects.
	pauseAnimation()
	{
		C3.Plugins.Spriter.Acts.PauseAnimation.call(this);
	},

	ResumeAnimation()
	{
		this._resumeAnimation();
	},

	// Legacy ACE alias used by older projects.
	resumeAnimation()
	{
		C3.Plugins.Spriter.Acts.ResumeAnimation.call(this);
	},

	PlayAnimTo(units, targetValue)
	{
		this._playAnimTo(units, targetValue);
	},

	// Legacy ACE alias used by older projects.
	playAnimTo(units, targetValue)
	{
		C3.Plugins.Spriter.Acts.PlayAnimTo.call(this, units, targetValue);
	},

	SetEntity(entityName, animationName)
	{
		this._setEnt(entityName, animationName);
	},

	// Legacy ACE alias used by older projects.
	setEnt(entityName, animationName)
	{
		C3.Plugins.Spriter.Acts.SetEntity.call(this, entityName, animationName);
	},

	SetObjectScaleRatio(scaleRatio, xFlip, yFlip)
	{
		this._setObjectScaleRatio(scaleRatio, xFlip, yFlip);
	},

	// Legacy ACE alias used by older projects.
	setObjectScaleRatio(scaleRatio, xFlip, yFlip)
	{
		C3.Plugins.Spriter.Acts.SetObjectScaleRatio.call(this, scaleRatio, xFlip, yFlip);
	},

	SetObjectXFlip(xFlip)
	{
		this._setObjectXFlip(xFlip);
	},

	// Legacy ACE alias used by older projects.
	setObjectXFlip(xFlip)
	{
		C3.Plugins.Spriter.Acts.SetObjectXFlip.call(this, xFlip);
	},

	SetObjectYFlip(yFlip)
	{
		this._setObjectYFlip(yFlip);
	},

	// Legacy ACE alias used by older projects.
	setObjectYFlip(yFlip)
	{
		C3.Plugins.Spriter.Acts.SetObjectYFlip.call(this, yFlip);
	},

	SetIgnoreGlobalTimeScale(ignore)
	{
		this._setIgnoreGlobalTimeScale(ignore);
	},

	// Legacy ACE alias used by older projects.
	setIgnoreGlobalTimeScale(ignore)
	{
		C3.Plugins.Spriter.Acts.SetIgnoreGlobalTimeScale.call(this, ignore);
	},

	SetAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer)
	{
		this._setAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer);
	},

	// Legacy ACE alias used by older projects.
	setAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer)
	{
		C3.Plugins.Spriter.Acts.SetAutomaticPausing.call(this, newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer);
	},

	StopResumeSettingLayer(resume)
	{
		this._stopResumeSettingLayer(resume);
	},

	// Legacy ACE alias used by older projects.
	stopResumeSettingLayer(resume)
	{
		C3.Plugins.Spriter.Acts.StopResumeSettingLayer.call(this, resume);
	},

	StopResumeSettingVisibilityForObjects(resume)
	{
		this._stopResumeSettingVisibilityForObjects(resume);
	},

	// Legacy ACE alias used by older projects.
	stopResumeSettingVisibilityForObjects(resume)
	{
		C3.Plugins.Spriter.Acts.StopResumeSettingVisibilityForObjects.call(this, resume);
	},

	StopResumeSettingCollisionsForObjects(resume)
	{
		this._stopResumeSettingCollisionsForObjects(resume);
	},

	// Legacy ACE alias used by older projects.
	stopResumeSettingCollisionsForObjects(resume)
	{
		C3.Plugins.Spriter.Acts.StopResumeSettingCollisionsForObjects.call(this, resume);
	},

	SetVisible(visible)
	{
		this._setVisible(visible);
	},

	// Legacy ACE alias used by older projects.
	setVisible(visible)
	{
		C3.Plugins.Spriter.Acts.SetVisible.call(this, visible);
	},

	SetOpacity(opacityPercent)
	{
		this._setOpacity(opacityPercent);
	},

	// Legacy ACE alias used by older projects.
	setOpacity(opacityPercent)
	{
		C3.Plugins.Spriter.Acts.SetOpacity.call(this, opacityPercent);
	},

	SetSecondAnim(animationName)
	{
		this._setSecondAnim(animationName);
	},

	// Legacy ACE alias used by older projects.
	setSecondAnim(animationName)
	{
		C3.Plugins.Spriter.Acts.SetSecondAnim.call(this, animationName);
	},

	StopSecondAnim()
	{
		this._stopSecondAnim();
	},

	// Legacy ACE alias used by older projects.
	stopSecondAnim()
	{
		C3.Plugins.Spriter.Acts.StopSecondAnim.call(this);
	},

	AppendCharMap(mapName)
	{
		this._appendCharMap(mapName);
	},

	// Legacy ACE alias used by older projects.
	appendCharMap(mapName)
	{
		C3.Plugins.Spriter.Acts.AppendCharMap.call(this, mapName);
	},

	RemoveCharMap(mapName)
	{
		this._removeCharMap(mapName);
	},

	// Legacy ACE alias used by older projects.
	removeCharMap(mapName)
	{
		C3.Plugins.Spriter.Acts.RemoveCharMap.call(this, mapName);
	},

	RemoveAllCharMaps()
	{
		this._removeAllCharMaps();
	},

	// Legacy ACE alias used by older projects.
	removeAllCharMaps()
	{
		C3.Plugins.Spriter.Acts.RemoveAllCharMaps.call(this);
	},

	OverrideObjectComponent(objectName, component, newValue)
	{
		this._overrideObjectComponent(objectName, component, newValue);
	},

	// Legacy ACE alias used by older projects.
	overrideObjectComponent(objectName, component, newValue)
	{
		C3.Plugins.Spriter.Acts.OverrideObjectComponent.call(this, objectName, component, newValue);
	},

	OverrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength)
	{
		this._overrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength);
	},

	// Legacy ACE alias used by older projects.
	overrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength)
	{
		C3.Plugins.Spriter.Acts.OverrideBonesWithIk.call(this, parentBoneName, childBoneName, targetX, targetY, additionalLength);
	},

	SetAnimBlendRatio(blendRatio)
	{
		this._setAnimBlendRatio(blendRatio);
	},

	// Legacy ACE alias used by older projects.
	setAnimBlendRatio(blendRatio)
	{
		C3.Plugins.Spriter.Acts.SetAnimBlendRatio.call(this, blendRatio);
	},

	SetZElevation(zElevation)
	{
		this._setZElevation(zElevation);
	},

	// Legacy ACE alias used by older projects.
	setZElevation(zElevation)
	{
		C3.Plugins.Spriter.Acts.SetZElevation.call(this, zElevation);
	},

	loadFromURL(url, crossOrigin, sconText)
	{
		return this._loadFromURL(url, crossOrigin, sconText);
	},

	FindSpriterObject(c2Object)
	{
		this._findSpriterObject(c2Object);
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
