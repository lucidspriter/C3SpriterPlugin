"use strict";

{
	const C3 = self.C3;

	C3.Plugins.Spriter.Acts =
	{
		setPlaybackSpeedRatio(newSpeed)
		{
			this.speedRatio = newSpeed;
		},

		setVisible(visible)
		{
			if (visible === 1)
			{
				this.GetWorldInfo().SetVisible(true);
			}
			else
			{
				this.GetWorldInfo().SetVisible(false);
			}
		},
		setOpacity(newOpacity)
		{
			this.GetWorldInfo().SetOpacity(this.clamp(0.0, 1.0, newOpacity / 100.0));
			//this.opacity = this.clamp(0.0, 1.0, newOpacity / 100.0);
		},
		setAutomaticPausing(newPauseSetting, leftBuffer, rightBuffer, topBuffer, bottomBuffer)
		{
			this.pauseWhenOutsideBuffer = newPauseSetting;
			this.leftBuffer = leftBuffer;
			this.rightBuffer = rightBuffer;
			this.topBuffer = topBuffer;
			this.bottomBuffer = bottomBuffer;
		},
		setObjectScaleRatio(newScale, xFlip, yFlip)
		{
			this.scaleRatio = newScale;
			this.xFlip = xFlip;
			this.yFlip = yFlip;
			this.force = true;
		},

		setObjectXFlip(xFlip)
		{
			this.xFlip = xFlip;
			this.force = true;
		},

		setIgnoreGlobalTimeScale(ignore)
		{
			this.ignoreGlobalTimeScale = (ignore == 1);
		},

		findSpriterObject(c2Object)
		{
			if (this.currentAnimation)
			{
				var timelines = this.currentAnimation.timelines;
				for (var t = 0; t < timelines.length; t++)
				{
					var timeline = timelines[t];
					if (timeline && timeline.c2Object)
					{
						if (timeline.c2Object.inst == c2Object.GetFirstPicked())
						{
							this.lastFoundObject = timeline.name;
							return;
						}
					}
				}
			}
		},

		stopResumeSettingLayer(resume)
		{
			this.setLayersForSprites = resume == 1;
		},
		
		stopResumeSettingVisibilityForObjects(resume)
		{
			this.setVisibilityForObjects = resume == 1;
		},
		
		stopResumeSettingCollisionsForObjects(resume)
		{
			this.setCollisionsForObjects = resume == 1;
		},

		setObjectYFlip(yFlip)
		{
			this.yFlip = yFlip;
			this.force = true;
		},
		
		setC2ObjectToSpriterObject(c2Object, propertiesToSet, spriterObjectName)
		{
			var c2instance = c2Object.GetSolStack()._current._instances;
			if (c2instance.length === 0 && c2Object.GetSolStack()._current._selectAll === true)
				c2instance = c2Object._instances;
			this.objectsToSet.push(this.C2ObjectToSpriterObjectInstruction(c2instance, spriterObjectName, propertiesToSet, false));
		},

		pinC2ObjectToSpriterObject(c2Object, propertiesToSet, spriterObjectName)
		{
			var c2instance = c2Object.GetSolStack()._current._instances;
			if (c2instance.length === 0 && c2Object.GetSolStack()._current._selectAll === true)
				c2instance = c2Object._instances;
			this.objectsToSet.push(this.C2ObjectToSpriterObjectInstruction(c2instance, spriterObjectName, propertiesToSet, true));
		},

		unpinC2ObjectFromSpriterObject(c2Object, spriterObjectName)
		{
			var allObjs = spriterObjectName === "";
			for (var i = 0; i < this.objectsToSet.length; i++)
			{
				if (this.objectsToSet[i].c2Object[0].type === c2Object && (allObjs ? true : this.objectsToSet[i].objectName === spriterObjectName))
				{
					this.objectsToSet.splice(i, 1);
					i--;
				}
			}
		},

		unpinAllFromSpriterObject(spriterObjectName)
		{
			if (spriterObjectName === "")
			{
				this.objectsToSet = [];
			}
			else
			{
				for (var i = 0; i < this.objectsToSet.length; i++)
				{
					if (this.objectsToSet[i].objectName === spriterObjectName)
					{
						this.objectsToSet.splice(i, 1);
						i--;
					}
				}
			}
		},

		setAnimation(animName, startFrom, blendDuration)
		{
			this.setAnim(animName, startFrom, blendDuration);
		},
		
		async LoadURL(url, crcrossOrigin) {
			var _currentAnimation = this._objectClass.GetAnimations()[0];
            var curAnimFrame = _currentAnimation.GetFrameAt(0);		
            var curImageInfo = curAnimFrame.GetImageInfo();
			//_currentAnimation._frames.push(new C3.AnimationFrameInfo(curImageInfo));
			var clonedFrameData=this.FrameDataFromImageInfo(curImageInfo);
			var newFrame = new C3.AnimationFrameInfo(clonedFrameData);
			_currentAnimation._frames.push(newFrame);
			
			//curAnimFrame=newFrame;
			//curImageInfo=newFrame.GetImageInfo();
            const wi = this.GetWorldInfo();
            const runtime = this._runtime;
            if (curImageInfo.GetURL() === url) {
                if (true)// resize === 0) 
				{
                    wi.SetSize(curImageInfo.GetWidth(), curImageInfo.GetHeight());
                    wi.SetBboxChanged();
                }
                this.Trigger(C3.Plugins.Spriter.Cnds.OnURLLoaded);
                return;
            }
            const imageInfo = C3.New(C3.ImageInfo);
            await imageInfo.LoadDynamicAsset(runtime, url);
            if (!imageInfo.IsLoaded()) {
                this.Trigger(C3.Plugins.Spriter.Cnds.OnURLFailed);
                return
            }
            await imageInfo.LoadStaticTexture(runtime.GetWebGLRenderer(), {
                sampling: this._runtime.GetSampling()
            });
            curImageInfo.ReplaceWith(imageInfo);
            //this._sdkType._UpdateAllCurrentTexture();
            if (!this.WasReleased())// && resize === 0) 
			{
                wi.SetSize(curImageInfo.GetWidth(), curImageInfo.GetHeight());
                wi.SetBboxChanged()
            }
            runtime.UpdateRender();
            if (!this.WasReleased())
                await this.TriggerAsync(C3.Plugins.Spriter.Cnds.OnURLLoaded)
        },

		setSecondAnim(animName)
		{
			this.secondAnimation = this.getAnimFromEntity(animName);
			if (this.secondAnimation === this.currentAnimation)
			{
				this.secondAnimation = null;
			}
		},
		stopSecondAnim(animName)
		{
			this.secondAnimation = null;
			this.animBlend = 0;
		},
		setAnimBlendRatio(newBlend)
		{
			this.animBlend = newBlend;
		},
		setEnt(entName, animName)
		{
			var newAnimName = animName;
			if (this.entity && this.currentAnimation && this.entity.name == entName && this.currentAnimation.name == animName)
			{
				return;
			}
			var newEntSet = false;

			if (this.currentAnimation && newAnimName === "")
			{
				newAnimName = this.currentAnimation.name;
			}
			var sameAnimName = false;
			if (newAnimName === this.currentAnimation.name)
			{
				sameAnimName = true;
			}
			if (entName !== "" && ((!this.entity) || entName != this.entity.name))
			{
				this.setEntTo(entName);
				newEntSet = true;
			}

			if (newAnimName !== "" && (newEntSet || !sameAnimName))
			{
				this.setAnimTo(newAnimName, true, true);
			}

		},

		playAnimTo(units, playTo)
		{
			if (units === 0) // keyframes
			{
				var mainKeys = this.currentAnimation.mainlineKeys;
				if (mainKeys)
				{
					var key = mainKeys[playTo];
					if (key)
					{
						this.playTo = key.time;
					}
					else
					{
						this.playTo = -1;
						return;
					}
				}
			}
			else if (units == 1) // milliseconds
			{
				this.playTo = playTo;
			}
			else if (units == 2) // ratio
			{
				this.playTo = playTo * this.currentAnimation.length;
			}
			if (this.playTo == this.currentSpriterTime)
			{
				this.playTo = -1;
				return;
			}
			var reverseFactor = 1;
			if (this.currentAnimation.looping == "true")
			{
				var forwardDistance = 0;
				var backwardDistance = 0;
				if (this.playTo > this.currentSpriterTime)
				{
					forwardDistance = this.playTo - this.currentSpriterTime;
					backwardDistance = (this.currentAnimation.length - this.playTo) + this.currentSpriterTime;
				}
				else
				{
					forwardDistance = this.playTo + (this.currentAnimation.length - this.currentSpriterTime);
					backwardDistance = this.currentSpriterTime - this.playTo;
				}
				if (backwardDistance < forwardDistance)
				{
					reverseFactor = -1;
				}
			}
			else
			{
				if (this.playTo < this.currentSpriterTime)
				{
					reverseFactor = -1;
				}
			}
			this.speedRatio = Math.abs(this.speedRatio) * reverseFactor;
			this.animPlaying = true;
			this.Tick2();
		},
        async loadFromURL(url, crossOrigin, sconText) {
			this.ProcessRawTextFile(JSON.parse(sconText));
            var _currentAnimation = this._objectClass.GetAnimations()[0];
            var curAnimFrame = _currentAnimation.GetFrameAt(0);		
            var curImageInfo = curAnimFrame.GetImageInfo();
			//_currentAnimation._frames.push(new C3.AnimationFrameInfo(curImageInfo));
			var clonedFrameData=this.FrameDataFromImageInfo(curImageInfo);
			var newFrame = new C3.AnimationFrameInfo(clonedFrameData);
			_currentAnimation._frames.push(newFrame);
			
			//curAnimFrame=newFrame;
			//curImageInfo=newFrame.GetImageInfo();
            const wi = this.GetWorldInfo();
            const runtime = this._runtime;
            if (curImageInfo.GetURL() === url) {
                if (true) {
                    wi.SetSize(curImageInfo.GetWidth(), curImageInfo.GetHeight());
                    wi.SetBboxChanged()
                }
                // this.Trigger(C3.Plugins.Sprite.Cnds.OnURLLoaded);
                return
            }
            const imageInfo = C3.New(C3.ImageInfo);
            await imageInfo.LoadDynamicAsset(runtime, url);
            if (!imageInfo.IsLoaded()) {
                // this.Trigger(C3.Plugins.Sprite.Cnds.OnURLFailed);
                return
            }
            await imageInfo.LoadStaticTexture(runtime.GetWebGLRenderer(), {
                sampling: this._runtime.GetSampling()
            });
            curImageInfo.ReplaceWith(imageInfo);
            this._sdkType._UpdateAllCurrentTexture();
            if (!this.WasReleased() && true) {
                wi.SetSize(curImageInfo.GetWidth(), curImageInfo.GetHeight());
                wi.SetBboxChanged()
            }
            runtime.UpdateRender();
            // if (!this.WasReleased())
                // await this.TriggerAsync(C3.Plugins.Sprite.Cnds.OnURLLoaded)
        },
		associateTypeWithName(type, name)
		{
			var c2ObjectArray = this.c2ObjectArray;
			var objectArray = this.objectArray;
			
			for (var o = 0, len = objectArray.length; o < len; o++)
			{
				var obj = objectArray[o];
				if (name == obj.name)
				{
					obj.fullTypeName = type.GetName();
					var c2Object = c2ObjectArray[o];
					c2Object.type = type;
					var iid = this.GetInstance().GetIID(); // get my IID
					
					var paired_inst = type.GetInstances()[iid];
					c2Object.inst = paired_inst;
			
					var animations = this.entity.animations;
					for (var a = 0, lenA = animations.length; a < lenA; a++)
					{
						var animation = animations[a];
						var timelines = animation.timelines;
						for (var t = 0, lenT = timelines.length; t < lenT; t++)
						{
							var timeline = timelines[t];
							if (name == timeline.name)
							{
								timeline.c2Object = c2Object;
							}
						}
					}
					break;
				}
			}
		},
		setAnimationLoop(loopOn)
		{
			var currentAnimation = this.currentAnimation;
			if (this.changeAnimTo)
			{
				currentAnimation = this.changeAnimTo;
			}
			if (currentAnimation)
			{
				if (loopOn === 0)
				{
					currentAnimation.looping = "false";
				}
				else if (loopOn == 1)
				{
					currentAnimation.looping = "true";
				}
			}
			else
			{
				if (loopOn === 0)
				{
					this.startingLoopType = "false";
				}
				else if (loopOn == 1)
				{
					this.startingLoopType = "true";
				}
			}
		},
		setAnimationTime(units, time)
		{
			this.resetEventChecksToTime(time);
			this.setAnimTime(units, time);
		},
		pauseAnimation()
		{
			this.animPlaying = false;
		},

		resumeAnimation()
		{
			if (this.animPlaying === false)
			{
				this.lastKnownTime = this.getNowTime();
			}
			this.animPlaying = true;
			var anim = this.currentAnimation;
			if (anim)
			{
				if (this.speedRatio > 0)
				{
					if (this.currentSpriterTime == anim.length)
					{
						this.currentSpriterTime = 0;
					}
				}
				else if (this.currentSpriterTime === 0)
				{
					this.currentSpriterTime = this.currentAnimation.length;
				}
			}
		},

		removeAllCharMaps()
		{
			var c2Objs = this.c2ObjectArray;
			for (var c = 0; c < c2Objs.length; c++)
			{
				var c2Obj = c2Objs[c];
				c2Obj.appliedMap = [];
			}
			this.Tick2(true);
		},

		appendCharMap(mapName)
		{
			var c2Objs = this.c2ObjectArray;
			var mapApplied = false;
			for (var c = 0; c < c2Objs.length; c++)
			{
				var c2Obj = c2Objs[c];
				if (c2Obj)
				{
					if (c2Obj.obj)
					{
						var charMap = c2Obj.obj.charMaps[mapName];
						if (charMap)
						{
							for (var m = 0; m < charMap.length; m++)
							{
								var map = charMap[m];
								if (map)
								{
									c2Obj.appliedMap[map.oldFrame] = map.newFrame;
									mapApplied = true;
								}
							}
						}
					}
				}
			}
			if(mapApplied)
			{
				this.appliedCharMaps.push(mapName);
				this.Tick2(true);
			}
		},
		
		removeCharMap(mapName)
		{
			var mapRemoved = false;
			for (var m = 0; m < this.appliedCharMaps.length; m++)
			{
				var map = this.appliedCharMaps[m];
				if(map == mapName)
				{
					this.appliedCharMaps.splice(m, 1);
					mapRemoved = true;
					break;
				}
			}
			if(!mapRemoved)
			{
				return;
			}
			var c2Objs = this.c2ObjectArray;
			for (var c = 0; c < c2Objs.length; c++)
			{
				var c2Obj = c2Objs[c];
				c2Obj.appliedMap = [];
			}
			this.Tick2(true);
			for (var i = 0; i < this.appliedCharMaps.length; i++)
			{
				var map = this.appliedCharMaps[m];
				var c2Objs = this.c2ObjectArray;
				for (var c = 0; c < c2Objs.length; c++)
				{
					var c2Obj = c2Objs[c];
					if (c2Obj)
					{
						if (c2Obj.obj)
						{
							var charMap = c2Obj.obj.charMaps[map];
							if (charMap)
							{
								for (var m = 0; m < charMap.length; m++)
								{
									var map = charMap[m];
									if (map)
									{
										c2Obj.appliedMap[map.oldFrame] = map.newFrame;
									}
								}
							}
						}
					}
				}
			}
			this.Tick2(true);
		},

		overrideObjectComponent(objectName, component, newValue)
		{
			var override = this.objectOverrides[objectName];
			if (typeof override === 'undefined')
			{
				this.objectOverrides[objectName] = {};
				override = this.objectOverrides[objectName];
			}
			override[component] = newValue;
		},

		overrideBonesWithIk(parentBoneName, childBoneName, targetX, targetY, additionalLength)
		{
			var override = this.boneIkOverrides[parentBoneName];
			if (typeof override === 'undefined')
			{
				this.boneIkOverrides[parentBoneName] = {};
				override = this.boneIkOverrides[parentBoneName];
			}
			override.targetX = targetX;
			override.targetY = targetY;
			override.childBone = childBoneName;
			override.additionalLength = additionalLength;
		}
	};
}