const C3 = globalThis.C3;

C3.Plugins.Spriter.Exps =
{
	LastError(this: any)
	{
		return this.loadErrorMessage || "";
	}
};
