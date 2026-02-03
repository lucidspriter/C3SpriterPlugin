
const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Spriter;

class SpriterInstance extends SDK.IWorldInstanceBase
{
	constructor(sdkType: SDK.ITypeBase, inst: SDK.IWorldInstance)
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
	
	Draw(iRenderer: SDK.Gfx.IWebGLRenderer, iDrawParams: SDK.Gfx.IDrawParams)
	{
		// Editor-only placeholder until runtime rendering is implemented.
		iRenderer.SetAlphaBlend();
		iRenderer.SetColorFillMode();
		iRenderer.SetColorRgba(0.0, 0.3, 0.8, 0.15);
		iRenderer.Quad(this._inst.GetQuad());
	}
	
	OnPropertyChanged(id: string, value: EditorPropertyValueType)
	{
	}
	
	LoadC2Property(name: string, valueString: string)
	{
		return false;		// not handled
	}
};

PLUGIN_CLASS.Instance = SpriterInstance;

export type { SpriterInstance as SDKEditorInstanceClass };
