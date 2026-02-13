const SDK = globalThis.SDK;

const PLUGIN_CLASS = SDK.Plugins.Spriter;

function getFirstFrameForObjectType(objectType)
{
	if (!objectType || typeof objectType.GetAnimations !== "function")
	{
		return null;
	}

	const animations = objectType.GetAnimations();
	if (!Array.isArray(animations) || !animations.length)
	{
		return null;
	}

	const firstAnim = animations[0];
	if (!firstAnim || typeof firstAnim.GetFrames !== "function")
	{
		return null;
	}

	const frames = firstAnim.GetFrames();
	return Array.isArray(frames) && frames.length ? frames[0] : null;
}

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
		const objectType = (typeof this.GetObjectType === "function")
			? this.GetObjectType()
			: (this._inst && typeof this._inst.GetObjectType === "function")
				? this._inst.GetObjectType()
			: null;
		const firstFrame = getFirstFrameForObjectType(objectType);
		const imageInfo = firstFrame && typeof firstFrame.GetImageInfo === "function"
			? firstFrame.GetImageInfo()
			: null;
		const texture = imageInfo && typeof imageInfo.GetTexture === "function"
			? imageInfo.GetTexture()
			: null;
		const texRect = imageInfo && typeof imageInfo.GetTexRect === "function"
			? imageInfo.GetTexRect()
			: null;

		if (texture &&
			texRect &&
			typeof iRenderer.SetAlphaBlend === "function" &&
			typeof iRenderer.SetTextureFillMode === "function" &&
			typeof iRenderer.SetTexture === "function" &&
			typeof iRenderer.Quad3 === "function")
		{
			try
			{
				iRenderer.SetAlphaBlend();
				iRenderer.SetTextureFillMode();
				iRenderer.SetTexture(texture);
				iRenderer.Quad3(this._inst.GetQuad(), texRect);
				return;
			}
			catch
			{
				// Fall through to placeholder draw if textured preview APIs differ by SDK build.
			}
		}

		// Fallback placeholder when no frame texture is available yet.
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
