"use strict";

{
	const SDK = self.SDK;

	const PLUGIN_CLASS = SDK.Plugins.Spriter;

	PLUGIN_CLASS.Instance = class SpriterInstance extends SDK.IWorldInstanceBase
	{
		constructor(sdkType, inst)
		{
			super(sdkType, inst);
			this.inst=inst;
		}
		Release()
		{
		}
		OnCreate()
		{
		}
		OnPropertyChanged(id, value)
		{
		}
		LoadC2Property(name, valueString)
		{
			return false;       // not handled
		}
		OnPlacedInLayout()
		{
			this.inst.SetSize(50,50);
		}
		
		HasDoubleTapHandler()
		{
			return true;
		}
		
		OnDoubleTap()
		{
			this.GetObjectType().EditImage();
		}
		
		Draw(iRenderer, iDrawParams)
		{
			iRenderer.SetAlphaBlend();
			iRenderer.SetColorFillMode();
			
			if (this.HadTextureError())
				iRenderer.SetColorRgba(0.25, 0, 0, 0.25);
			else
				iRenderer.SetColorRgba(0, 0, 0.1, 0.1);
			
			iRenderer.Quad(this._inst.GetQuad());			
		}
	};
}
