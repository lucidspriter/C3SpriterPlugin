const C3 = globalThis.C3;

function compareValues(left, cmp, right)
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

	const x = String(left ?? "");
	const y = String(right ?? "");
	switch (cmp)
	{
		case 0: return x === y;
		case 1: return x !== y;
		case 2: return x < y;
		case 3: return x <= y;
		case 4: return x > y;
		case 5: return x >= y;
		default: return x === y;
	}
}

function lower(value)
{
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

C3.Plugins.Spriter.Cnds =
{
	OnReady()
	{
		return true;
	},

	// Legacy ACE alias used by older projects.
	readyForSetup()
	{
		return true;
	},

	OnLoadFailed()
	{
		return true;
	},

	OnURLLoaded()
	{
		return true;
	},

	OnURLFailed()
	{
		return true;
	},

	OnAnimFinished(animationName)
	{
		const triggerAnimationName = typeof this._triggeredFinishedAnimationName === "string"
			? this._triggeredFinishedAnimationName
			: "";
		const currentAnimationName = this.animation && typeof this.animation.name === "string"
			? this.animation.name
			: "";
		return lower(triggerAnimationName || currentAnimationName) === lower(animationName);
	},

	OnAnyAnimFinished()
	{
		return true;
	},

	OnEventTriggered(name)
	{
		const triggered = typeof this._triggeredEventName === "string" ? this._triggeredEventName : "";
		return lower(triggered) === lower(name);
	},

	outsidePaddedViewport()
	{
		return typeof this._isOutsideViewportBox === "function"
			? this._isOutsideViewportBox()
			: false;
	},

	OutsidePaddedViewport()
	{
		return C3.Plugins.Spriter.Cnds.outsidePaddedViewport.call(this);
	},

	tagActive(tagName, objectName)
	{
		return typeof this._tagActive === "function"
			? this._tagActive(tagName, objectName)
			: false;
	},

	CompareCurrentKey(cmp, frame)
	{
		return compareValues(this._currentMainlineKeyIndex || 0, cmp, frame);
	},

	CompareCurrentTime(cmp, timeValue, timeFormat)
	{
		if (Number(timeFormat) === 1)
		{
			const ratio = typeof this._getCurrentTimeRatio === "function"
				? this._getCurrentTimeRatio()
				: 0;
			return compareValues(ratio, cmp, timeValue);
		}

		return compareValues(this.localTimeMs || 0, cmp, timeValue);
	},

	CompareAnimation(name)
	{
		const checkedAnimationName = String(name ?? "");
		const helperAnimationName = (typeof this._getAnimationName === "function")
			? this._getAnimationName()
			: "";
		const currentAnimationName = helperAnimationName
			|| (this.animation && typeof this.animation.name === "string"
				? this.animation.name
				: "");
		return lower(currentAnimationName) === lower(checkedAnimationName);
	},

	CompareSecondAnimation(name)
	{
		const secondAnimationName = (typeof this._getSecondAnimationName === "function")
			? this._getSecondAnimationName()
			: "";
		if (!secondAnimationName)
		{
			return false;
		}
		return lower(secondAnimationName) === lower(name);
	},

	CompareEntity(name)
	{
		const currentEntityName = this.entity && typeof this.entity.name === "string"
			? this.entity.name
			: "";
		return lower(currentEntityName) === lower(name);
	},

	ActionPointExists(pointName)
	{
		return (typeof this._actionPointExists === "function")
			? this._actionPointExists(pointName)
			: false;
	},

	// Legacy ACE alias used by older projects.
	actionPointExists(pointName)
	{
		return C3.Plugins.Spriter.Cnds.ActionPointExists.call(this, pointName);
	},

	ObjectExists(objectName)
	{
		return (typeof this._objectExists === "function")
			? this._objectExists(objectName)
			: false;
	},

	// Legacy ACE alias used by older projects.
	objectExists(objectName)
	{
		return C3.Plugins.Spriter.Cnds.ObjectExists.call(this, objectName);
	},

	CompareZElevation(which, cmp, zElevation)
	{
		const useTotal = Number(which) === 1;
		const value = (typeof this._getWorldZElevation === "function")
			? this._getWorldZElevation(useTotal)
			: 0;
		return compareValues(value, cmp, zElevation);
	},

	AnimationPaused()
	{
		return !this.playing;
	},

	AnimationLooping()
	{
		return typeof this._isAnimationLooping === "function"
			? !!this._isAnimationLooping(this.animation)
			: true;
	},

	IsMirrored()
	{
		return !!this._xFlip;
	},

	// Legacy ACE alias used by older projects.
	isMirrored()
	{
		return C3.Plugins.Spriter.Cnds.IsMirrored.call(this);
	},

	IsFlipped()
	{
		return !!this._yFlip;
	},

	// Legacy ACE alias used by older projects.
	isFlipped()
	{
		return C3.Plugins.Spriter.Cnds.IsFlipped.call(this);
	},

	OnSoundTriggered()
	{
		return true;
	},

	OnSoundVolumeChangeTriggered()
	{
		return true;
	},

	OnSoundPanningChangeTriggered()
	{
		return true;
	},

	IsReady()
	{
		return !!this.isReady;
	}
};
