"use strict";

{
	const C3 = self.C3;

	function ToDegrees(angleInRadians)
	{
		return angleInRadians / 0.0174533;
	}
	
	C3.Plugins.Spriter.Exps =
	{
		// Double(number)
		// {
			// return number * 2;
		// }
		
		time()
		{
			return this.currentSpriterTime;
		},
		

		val(varname, objectName)
		{
			var anim = this.currentAnimation;
			if (anim)
			{
				if (objectName)
				{
					var line = this.timelineFromName(objectName);
					if (line)
					{
						return this.varStatus(varname, line.meta);
						
					}
				}
				else
				{
					return this.varStatus(varname, anim.meta);					
				}
			}
			return 0;
		},
		pointX(name)
		{
			var timeline = this.timelineFromName(name);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.x !== undefined)
				{
					return timeline.currentObjectState.x;
					
				}
			}
			return 0;
		},

		pointY(name)
		{
			var timeline = this.timelineFromName(name);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.y !== undefined)
				{
					return timeline.currentObjectState.y;
					
				}
			}
			return 0;
		},

		pointAngle(name)
		{
			var timeline = this.timelineFromName(name);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.angle !== undefined)
				{
					return ToDegrees(timeline.currentObjectState.angle);
					
				}
			}
			return 0;
		},
		
		objectX(name)
		{
			var timeline = this.timelineFromName(name);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.x !== undefined)
				{
					return timeline.currentObjectState.x;
					
				}
			}
			return 0;
		},

		objectY(name)
		{
			var timeline = this.timelineFromName(name);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.y !== undefined)
				{
					return timeline.currentObjectState.y;
					
				}
			}
			return 0;
		},

		objectAngle(name)
		{
			var timeline = this.timelineFromName(name);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.angle !== undefined)
				{
					return ToDegrees(timeline.currentObjectState.angle);
					
				}
			}
			return 0;
		},

		timeRatio()
		{
			if (this.currentAnimation)
			{
				return this.currentSpriterTime / this.currentAnimation.length;
			}
			else
			{
				return 0;
			}
		},

		ScaleRatio()
		{
			return this.scaleRatio;
		},

		key()
		{
			return this.currentFrame();
		},

		PlayTo()
		{
			return this.playTo;
		},

		animationName()
		{
			if (this.changeAnimTo)
			{
				return this.changeAnimTo.name;
			}
			//else if(this.currentAnimation)
			else if (this.currentAnimation)
			{
				return this.currentAnimation.name;
			}
			else
			{
				return "";
			}
		},

		animationLength()
		{
			if (this.currentAnimation)
			{
				return this.currentAnimation.length;
			}
			else
			{
				return 0;
			}
		},

		speedRatio()
		{
			return this.speedRatio;
		},

		secondAnimationName()
		{
			if (this.secondAnimation)
			{
				return this.secondAnimation.name;
			}
			else
			{
				return "";
			}
		},

		entityName()
		{
			if (this.entity)
			{
				return this.entity.name;
			}
			else
			{
				return "";
			}
		},

		PlayToTimeLeft()
		{
			if (this.playTo < 0)
			{
				return 0;
			}

			if (this.currentAnimation.looping == "true")
			{
				var forwardDistance = 0;
				var backwardDistance = 0;
				if (this.speedRatio >= 0)
				{
					if (this.playTo > this.currentSpriterTime)
					{
						return this.playTo - this.currentSpriterTime;
					}
					else
					{
						return this.playTo + (this.currentAnimation.length - this.currentSpriterTime);
					}
				}
				else
				{
					if (this.playTo > this.currentSpriterTime)
					{
						return (this.currentAnimation.length - this.playTo) + this.currentSpriterTime;
					}
					else
					{
						return this.currentSpriterTime - this.playTo;
					}
				}
			}
			else
			{
				return Math.abs(this.playTo - this.currentSpriterTime);
			}

		},
		triggeredSound()
		{
			return this.soundToTrigger;
		},

		triggeredSoundTag()
		{
			if (this.soundLineToTrigger)
			{
				return this.soundLineToTrigger.name;
				
			}
			//else
			return "";
		},

		soundVolume(soundTag)
		{
			var soundline = this.soundlineFromName(soundTag);
			if (soundline)
			{
				if (soundline.currentObjectState)
				{
					return soundline.currentObjectState.volume;
					
				}
			}
			return 0;
		},

		soundPanning(soundTag)
		{
			var soundline = this.soundlineFromName(soundTag);
			if (soundline)
			{
				if (soundline.currentObjectState)
				{
					return soundline.currentObjectState.panning;
					
				}
			}
			return 0;
		},

		blendRatio()
		{
			return this.animBlend;
		},

		Opacity()
		{
			return this.GetWorldInfo().GetOpacity() * 100.0;
		},

		BBoxLeft()
		{
			this.update_bbox();
			return this.bbox.left;
		},

		BBoxTop()
		{
			this.update_bbox();
			return this.bbox.top;
		},

		BBoxRight()
		{
			this.update_bbox();
			return this.bbox.right;
		},

		BBoxBottom()
		{
			this.update_bbox();
			return this.bbox.bottom;
		},

		foundObject()
		{
			return this.lastFoundObject;
		},

		ZElevation()
		{
			return this.GetWorldInfo().GetZElevation();
		},

		TotalZElevation()
		{
			return this.GetWorldInfo().GetTotalZElevation();
		}
	};
	
}