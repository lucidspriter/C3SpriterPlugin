const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Spriter;

PLUGIN_CLASS.Type = class SpriterType extends SDK.ITypeBase
{
	constructor(sdkPlugin: SDK.IPluginBase, iObjectType: SDK.IObjectType)
	{
		super(sdkPlugin, iObjectType);
	}
};

export {}
