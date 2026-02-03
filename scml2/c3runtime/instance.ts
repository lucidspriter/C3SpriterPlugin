
const C3 = globalThis.C3;

class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
	_initialProperties: readonly JSONValue[];
	_didLogTick: boolean;
	_didLogDraw: boolean;

	constructor()
	{
		super();
		
		const properties = this._getInitProperties();
		this._initialProperties = properties ? [...properties] : [];
		this._didLogTick = false;
		this._didLogDraw = false;

		// Keep a basic update loop active so we can verify preview is running.
		if (typeof this._StartTicking === "function")
		{
			this._StartTicking();
		}
	}
	
	_release()
	{
		super._release();
	}

	_tick()
	{
		if (this._didLogTick)
		{
			return;
		}

		this._didLogTick = true;
		console.log("[Spriter] Tick reached runtime update phase.");
	}
	
	_draw(renderer: IRenderer)
	{
		if (!this._didLogDraw)
		{
			this._didLogDraw = true;
			console.log("[Spriter] Draw reached runtime render phase.");
		}

		// No rendering yet.
	}
	
	_saveToJson()
	{
		return {
			// data to be saved for savegames
		};
	}
	
	_loadFromJson(o: JSONValue)
	{
		// load state for savegames
	}
};

C3.Plugins.Spriter.Instance = SpriterInstance;

export type { SpriterInstance as SDKInstanceClass };
