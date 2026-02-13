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

	OnAnimFinished(animationName)
	{
		const currentAnimationName = this.animation && typeof this.animation.name === "string"
			? this.animation.name
			: "";
		return lower(currentAnimationName) === lower(animationName);
	},

	OnAnyAnimFinished()
	{
		return true;
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
		const currentAnimationName = this.animation && typeof this.animation.name === "string"
			? this.animation.name
			: "";
		return lower(currentAnimationName) === lower(name);
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
