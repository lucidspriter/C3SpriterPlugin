const C3 = globalThis.C3;

C3.Plugins.Spriter.Acts =
{
	AssociateTypeWithName(this: any, objectType: any, name: string)
	{
		this._associateTypeWithName(objectType, name);
	},

	PinC3ObjectToSpriterObject(this: any, c3Object: any, setType: number, name: string)
	{
		this._pinC2ObjectToSpriterObject(c3Object, setType, name);
	},

	SetC3ObjectToSpriterObject(this: any, c3Object: any, setType: number, name: string)
	{
		this._setC2ObjectToSpriterObject(c3Object, setType, name);
	},

	UnpinC3ObjectFromSpriterObject(this: any, c3Object: any, name: string)
	{
		this._unpinC2ObjectFromSpriterObject(c3Object, name);
	},

	UnpinAllFromSpriterObject(this: any, name: string)
	{
		this._unpinAllFromSpriterObject(name);
	}
};
