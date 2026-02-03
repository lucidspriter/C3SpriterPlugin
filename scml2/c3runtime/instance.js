const C3 = globalThis.C3;

C3.Plugins.Spriter.Instance = class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
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
	
	_draw(renderer)
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
	
	_loadFromJson(o)
	{
		// load state for savegames
	}
};
