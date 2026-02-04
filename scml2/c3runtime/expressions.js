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

	ObjectCount()
	{
		const states = this._poseObjectStates;
		return Array.isArray(states) ? states.length : 0;
	},

	EntityName()
	{
		const entity = this.entity;
		return entity && typeof entity.name === "string" ? entity.name : "";
	},

	AnimationName()
	{
		const animation = this.animation;
		return animation && typeof animation.name === "string" ? animation.name : "";
	}
};
