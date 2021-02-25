"use strict";

{
	const C3 = self.C3;

	function DoCmp(a, cmp, b)
	{
		switch(cmp)
		{
			case 0:
				return a == b;
				
			case 1:
				return a != b;
				
			case 2:
				return a < b;
				
			case 3:
				return a <= b;
				
			case 4:
				return a > b;
				
			case 5:
				return a >= b;
		}
	}
	
	C3.Plugins.Spriter.Cnds =
	{		
		readyForSetup()
		{
			this._inst._objectType._SetIIDsStale();
			return true;
		},

		outsidePaddedViewport()
		{
			return this.isOutsideViewportBox();
		},

		actionPointExists (pointName)
		{
			var timeline = this.timelineFromName(pointName);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.x !== undefined)
				{
					return true;
				}
			}
			return false;
		},
		
		objectExists (pointName)
		{
			var timeline = this.timelineFromName(pointName);
			if (timeline && timeline.currentObjectState)
			{
				if (timeline.currentObjectState.x !== undefined)
				{
					return true;
				}
			}
			return false;
		},
		
		OnAnimFinished (animname)
		{
			return this.currentAnimation.name.toLowerCase() === animname.toLowerCase();
		},
		
		OnSoundTriggered()
		{
			return true;
		},
		
		OnEventTriggered (name)
		{
			if (name === this.eventToTrigger)
			{
				return true;
			}
		},

		tagActive (tagName, objectName)
		{
			var anim = this.currentAnimation;
			if (anim)
			{
				if (objectName&&objectName!="")
				{
					var line = this.timelineFromName(objectName);
					if (line)
					{
						return this.tagStatus(tagName, line.meta);
					}
				}
				else
				{
					return this.tagStatus(tagName, anim.meta);
				}
			}
			return false;
		},

		OnSoundVolumeChangeTriggered()
		{
			return true;
		},
		
		OnSoundPanningChangeTriggered()
		{
			return true;
		},
		
		OnAnyAnimFinished()
		{
			return true;
		},
		
		// AddCmpParam("Current Key Frame is ", "Is the current Key Frame <,>,=,etc to the value below");
		// AddNumberParam("Frame","The frame number to compare the current key frame to" ,"0")	;
		// AddCondition(2,0, "Compare Current Key Frame", "Key Frames", "Current Key Frame is {0} {1}", "Compare the current key frame number.", "CompareCurrentKey");
		CompareCurrentKey (cmp, frame)
		{
			return DoCmp(this.currentFrame(), cmp, frame);
		},     
		OnURLLoaded() {
            return true;
        },
        OnURLFailed() {
            return true;
        },
		
		// AddCmpParam("Current Animation Time is ", "Is the current time <,>,=,etc to the value below");
		// AddNumberParam("Time","The time to compare the current key frame to" ,"0")	;
		// AddComboParamOption("milliseconds");
		// AddComboParamOption("ratio of the animation length");
		// AddComboParam("Time Format", "Is the 'Time' value above expressed in milliseconds or as a ratio",0);
		// AddCondition(3,0, "Compare Current Time", "Animations", "Current Time is {0} {1} {2}", "Compare the current time.", "CompareCurrentTime");
		CompareCurrentTime (cmp, time, format)
		{
			if (format === 0) //milliseconds
			{
				return DoCmp(this.currentSpriterTime, cmp, time);
			}
			else
			{
				var anim = this.currentAnimation;
				if (anim)
				{
					return DoCmp(this.currentSpriterTime / this.currentAnimation.length, cmp, time);
				}
				else
				{
					return false;
				}
			}
		},

		// AddStringParam("Animation", "Is this the current animation.");
		// AddCondition(4, 0, "Compare Current Animation", "Animations", "Is current animation {0}", "Compare the name of the current animation.", "CompareAnimation");
		CompareAnimation (name)
		{
			var blendingTo = this.secondAnimation;
			if (blendingTo && blendingTo.name === name && this.blendEndTime > 0)
			{
				return true;
			}
			var anim = this.currentAnimation;
			if (anim && anim.name === name)
			{
				return true;
			}
			else
			{
				return false;
			}
		},

		CompareSecondAnimation (name)
		{
			if (this.secondAnimation)
			{
				return name === this.secondAnimation.name;
			}
			else
			{
				return false;
			}
		},

		// AddStringParam("Entity", "Is this the current entity.");
		// AddCondition(16, 0, "Compare Current Entity", "Entities", "Is current entity {0}", "Compare the name of the current entity.", "CompareEntity");
		CompareEntity (name)
		{
			var ent = this.entity;
			if (ent && ent.name === name)
			{
				return true;
			}
			else
			{
				return false;
			}
		},

		// AddCondition(5, 0, "Is Paused", "Animations", "If animation is paused", "Is animation paused?", "AnimationPaused");
		AnimationPaused()
		{
			return !this.animPlaying;
		},
		// AddCondition(6, 0, "Is Looping", "Animations", "If animation is looping", "Is animation set to loop?", "AnimationLooping");
		AnimationLooping()
		{
			var anim = this.currentAnimation;
			if (anim && anim.looping === "true")
			{
				return true;
			}
			else
			{
				return false;
			}
		},

		isMirrored()
		{
			return this.xFlip;
		},

		isFlipped()
		{
			return this.yFlip;
		},
		
		CompareZElevation(which, comparison, z_elevation)
		{
			// which:
			// 0 = Z Elevation   
			// 1 = Total Z Elevation
			if(which == 0)
			{
				DoCmp(this.GetWorldInfo().GetZElevation(), comparison, z_elevation);
			}
			else
			{
				DoCmp(this.GetWorldInfo().GetTotalZElevation(), comparison, z_elevation);
			}
		}
		
		
		
	};
}