const C3 = globalThis.C3;

C3.Plugins.Spriter.Acts =
{
	AssociateTypeWithName(objectType, name)
	{
		this._associateTypeWithName(objectType, name);
	},

	PinC3ObjectToSpriterObject(c3Object, setType, name)
	{
		this._pinC2ObjectToSpriterObject(c3Object, setType, name);
	},

	SetC3ObjectToSpriterObject(c3Object, setType, name)
	{
		this._setC2ObjectToSpriterObject(c3Object, setType, name);
	},

	UnpinC3ObjectFromSpriterObject(c3Object, name)
	{
		this._unpinC2ObjectFromSpriterObject(c3Object, name);
	},

	UnpinAllFromSpriterObject(name)
	{
		this._unpinAllFromSpriterObject(name);
	}
};
