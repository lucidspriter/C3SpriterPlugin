
import type { SDKInstanceClass } from "./instance.ts";

const C3 = globalThis.C3;

C3.Plugins.Spriter.Type = class SpriterType extends globalThis.ISDKObjectTypeBase<SDKInstanceClass>
{
	constructor()
	{
		super();
	}
	
	_onCreate()
	{
		// TODO: initialise shared resources for Spriter instances.
	}
};
