const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Spriter;

PLUGIN_CLASS.Instance = class SpriterInstance extends SDK.IWorldInstanceBase
{
	constructor(sdkType, inst)
	{
		super(sdkType, inst);
	}
	
	Release()
	{
	}
	
	OnCreate()
	{
	}
	
	OnPlacedInLayout()
	{
		// Placeholder size until SCML metadata can drive bounds.
		this._inst.SetSize(50, 50);
	}
	
	Draw(iRenderer, iDrawParams)
	{
		// Editor-only placeholder until runtime rendering is implemented.
		iRenderer.SetAlphaBlend();
		iRenderer.SetColorFillMode();
		iRenderer.SetColorRgba(0.0, 0.3, 0.8, 0.15);
		iRenderer.Quad(this._inst.GetQuad());
	}
	
	OnPropertyChanged(id, value)
	{
	}
	
	LoadC2Property(name, valueString)
	{
		return false;		// not handled
	}
};
