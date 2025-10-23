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

        OnPropertyChanged(id, value)
        {
        }

        LoadC2Property(name, valueString)
        {
                return false;   // not handled
        }

        OnPlacedInLayout()
        {
                // Preserve behaviour from the legacy plugin until size management is reimplemented.
                this._inst.SetSize(50, 50);
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
                iRenderer.Quad(this._inst.GetQuad());
        }
};
