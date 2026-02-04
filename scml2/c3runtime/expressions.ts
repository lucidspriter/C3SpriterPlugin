const C3 = globalThis.C3;

C3.Plugins.Spriter.Exps =
{
	LastError(this: any)
	{
		return this.loadErrorMessage || "";
	},

	Time(this: any)
	{
		const timeMs = Number(this.localTimeMs);
		return Number.isFinite(timeMs) ? timeMs / 1000 : 0;
	},

	ObjectCount(this: any)
	{
		const states = this._poseObjectStates;
		return Array.isArray(states) ? states.length : 0;
	},

	EntityName(this: any)
	{
		const entity = this.entity;
		return entity && typeof entity.name === "string" ? entity.name : "";
	},

	AnimationName(this: any)
	{
		const animation = this.animation;
		return animation && typeof animation.name === "string" ? animation.name : "";
	}
};
