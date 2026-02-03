const C3 = globalThis.C3;

C3.Plugins.Spriter.Cnds =
{
	OnReady()
	{
		return true;
	},

	OnLoadFailed()
	{
		return true;
	},

	IsReady(this: any)
	{
		return !!this.isReady;
	}
};
