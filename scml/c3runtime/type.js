"use strict";

{
	const C3 = self.C3;

	C3.Plugins.Spriter.Type = class SpriterType extends C3.SDKTypeBase
	{
		constructor(objectClass)
		{
			super(objectClass);
		}
		
		Release()
		{
			super.Release();
		}
		
		
		OnCreate()
		{			
			var frames = this.GetObjectClass().GetAnimations()[0].GetFrames();
			for (var i = 0; i < frames.length; i++)
			{	
				frames[i].GetImageInfo().LoadAsset(this._runtime);				 
			}
			
			this.doGetFromPreload = false;
			this.scmlFiles = {};
			this.scmlReserved = {};
			this.scmlInstsToNotify = {};
			this.objectArrays = [];
			this.boneWidthArrays = [];

			this.sheetTex = {};
		}
		
		LoadTextures(renderer)
		{
			const promises =  [];
			var frames = this.GetObjectClass().GetAnimations()[0].GetFrames();
			for (var i = 0; i < frames.length; i++)
			{	
				var imageInfo = frames[i].GetImageInfo();
				imageInfo.GetTexture();
				promises.push(imageInfo.LoadStaticTexture(renderer,{sampling: this._runtime.GetSampling()}));				 
			}
			
			var proms = Promise.all(promises);	
			console.log(proms);
			return proms;
		
		}

		ReleaseTextures()
		{
			var frames = this.GetObjectClass().GetAnimations()[0].GetFrames();
			for (var i = 0; i < frames.length; i++)
			{	
				var imageInfo = frames[i].GetImageInfo();
				imageInfo.ReleaseTexture();
			}
		}	
		
		_UpdateAllCurrentTexture() 
		{
            for (const inst of this._objectClass.instancesIncludingPendingCreate())
                inst.GetSdkInstance()._UpdateCurrentTexture()
        }
		
		frame_getDataUri()
		{
			if (this.datauri.length === 0)
			{
				// Get Sprite image as data URI
				var tmpcanvas = document.createElement("canvas");
				tmpcanvas.width = this.width;
				tmpcanvas.height = this.height;
				var tmpctx = tmpcanvas.getContext("2d");

				if (this.spritesheeted)
				{
					tmpctx.drawImage(this.texture_img, this.offx, this.offy, this.width, this.height,
						0, 0, this.width, this.height);
				}
				else
				{
					tmpctx.drawImage(this.texture_img, 0, 0, this.width, this.height);
				}

				this.datauri = tmpcanvas.toDataURL("image/png");
			}

			return this.datauri;
		};
	};
}