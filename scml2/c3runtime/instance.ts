
const C3 = globalThis.C3;

// Temporary noisy logging to verify the runtime is ticking and that the latest dev-addon code is loaded.
// Remove or gate this once basic playback is in place.
const DEBUG_BUILD_ID = "scml2-dev-2026-02-03a";

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
	}

	_onCreate()
	{
		console.log(`[Spriter] _onCreate (debug build: ${DEBUG_BUILD_ID})`);

		// Register for ticks after the instance is created (constructor is too early in some runtimes).
		if (typeof this._StartTicking === "function")
		{
			this._StartTicking();
		}

		// Some plugins use a second tick pass; harmless if unsupported.
		if (typeof this._StartTicking2 === "function")
		{
			this._StartTicking2();
		}
	}
	
	_release()
	{
		super._release();
	}

	_tick()
	{
		// Intentionally logs every tick for debugging. Use Console filter "Spriter" or remove after testing.
		console.count("[Spriter] tick");
	}

	_tick2()
	{
		// Some runtimes drive updates via a second tick pass. Count it separately to diagnose tick wiring.
		console.count("[Spriter] tick2");
	}
	
	_draw(renderer: IRenderer)
	{
		if (!this._didLogDraw)
		{
			this._didLogDraw = true;
			console.log("[Spriter] Draw reached runtime render phase (alternate message).");
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
