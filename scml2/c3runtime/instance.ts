const C3 = globalThis.C3;

function normaliseProjectFileName(fileName: unknown): string
{
	if (typeof fileName !== "string")
	{
		return "";
	}

	let normalised = fileName.trim().toLowerCase();

	if (normalised.endsWith(".scml"))
	{
		normalised = normalised.replace(/\.scml$/, ".scon");
	}

	return normalised;
}

function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T>
{
	return !!(value && typeof (value as PromiseLike<T>).then === "function");
}

const PROPERTY_INDEX = Object.freeze({
	SCML_FILE: 0,
	STARTING_ENTITY: 1,
	STARTING_ANIMATION: 2,
	STARTING_OPACITY: 3,
	DRAW_SELF: 4,
	NICKNAME: 5,
	BLEND_MODE: 6
});

const DRAW_SELF_OPTIONS = ["false", "true"];
const BLEND_MODE_OPTIONS = ["no premultiplied alpha blend", "use effects blend mode"];

function toStringOrEmpty(value: unknown): string
{
	if (typeof value === "string")
	{
		return value;
	}

	if (value == null)
	{
		return "";
	}

	return String(value);
}

function toNumberOrDefault(value: unknown, defaultValue: number): number
{
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function normaliseComboValue(value: unknown, options: readonly string[], defaultIndex = 0): number
{
	if (typeof value === "number" && Number.isInteger(value))
	{
		if (value >= 0 && value < options.length)
		{
			return value;
		}
	}

	if (typeof value === "string")
	{
		const trimmed = value.trim();
		const lowerCased = trimmed.toLowerCase();

		for (let i = 0, len = options.length; i < len; i++)
		{
			if (options[i].toLowerCase() === lowerCased)
			{
				return i;
			}
		}

		const numericValue = Number(trimmed);

		if (Number.isInteger(numericValue) && numericValue >= 0 && numericValue < options.length)
		{
			return numericValue;
		}
	}

	return defaultIndex;
}

function normaliseInitialProperties(initialProperties: readonly JSONValue[]): JSONValue[]
{
	const source = Array.isArray(initialProperties) ? initialProperties : [];
	const normalised = [...source];

	normalised[PROPERTY_INDEX.SCML_FILE] = normaliseProjectFileName(toStringOrEmpty(source[PROPERTY_INDEX.SCML_FILE]));
	normalised[PROPERTY_INDEX.STARTING_ENTITY] = toStringOrEmpty(source[PROPERTY_INDEX.STARTING_ENTITY]);
	normalised[PROPERTY_INDEX.STARTING_ANIMATION] = toStringOrEmpty(source[PROPERTY_INDEX.STARTING_ANIMATION]);
	normalised[PROPERTY_INDEX.STARTING_OPACITY] = toNumberOrDefault(source[PROPERTY_INDEX.STARTING_OPACITY], 100);
	normalised[PROPERTY_INDEX.DRAW_SELF] = normaliseComboValue(source[PROPERTY_INDEX.DRAW_SELF], DRAW_SELF_OPTIONS, 0);
	normalised[PROPERTY_INDEX.NICKNAME] = toStringOrEmpty(source[PROPERTY_INDEX.NICKNAME]);
	normalised[PROPERTY_INDEX.BLEND_MODE] = normaliseComboValue(source[PROPERTY_INDEX.BLEND_MODE], BLEND_MODE_OPTIONS, 1);

	return normalised;
}

class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
	_initialProperties: readonly JSONValue[];
	properties: JSONValue[];
	projectFileName: string;
	startingEntityName: string;
	startingAnimationName: string;
	startingOpacity: number;
	drawSelf: boolean;
	nicknameInC2: string;
	noPremultiply: boolean;
	isReady: boolean;
	loadError: unknown;
	loadErrorMessage: string;
	projectData: unknown;
	_projectDataPromise: Promise<unknown> | null;
	_didTriggerReady: boolean;
	_didTriggerLoadFailed: boolean;
	_isReleased: boolean;

	constructor()
	{
		super();
		
		const initProperties = this._getInitProperties();
		this._initialProperties = initProperties ? [...initProperties] : [];
		this.properties = normaliseInitialProperties(this._initialProperties);

		this.projectFileName = this.properties[PROPERTY_INDEX.SCML_FILE] as string;
		this.startingEntityName = this.properties[PROPERTY_INDEX.STARTING_ENTITY] as string;
		this.startingAnimationName = this.properties[PROPERTY_INDEX.STARTING_ANIMATION] as string;
		this.startingOpacity = this.properties[PROPERTY_INDEX.STARTING_OPACITY] as number;
		this.drawSelf = (this.properties[PROPERTY_INDEX.DRAW_SELF] as number) === 1;
		this.nicknameInC2 = this.properties[PROPERTY_INDEX.NICKNAME] as string;
		this.noPremultiply = (this.properties[PROPERTY_INDEX.BLEND_MODE] as number) === 0;

		this.isReady = false;
		this.loadError = null;
		this.loadErrorMessage = "";
		this.projectData = null;
		this._projectDataPromise = null;
		this._didTriggerReady = false;
		this._didTriggerLoadFailed = false;
		this._isReleased = false;

		// Enable ticking (Addon SDK v2): _tick() runs before events; _tick2() runs after events.
		// https://www.construct.net/en/make-games/manuals/construct-3/scripting/scripting-reference/addon-sdk-interfaces/isdkinstancebase
		if (typeof this._setTicking === "function")
			this._setTicking(true);

		if (typeof this._setTicking2 === "function")
			this._setTicking2(true);
	}
	
	_release()
	{
		this._isReleased = true;
		super._release();
	}

	_tick()
	{
		this._loadProjectDataIfNeeded();

		// TODO (Phase 3): advance animation state.
	}

	_tick2()
	{
		// TODO (Phase 3): late tick tasks (after events), if needed.
	}
	
	_draw(renderer: IRenderer)
	{
		// TODO (Phase 4): self-draw rendering.
	}

	_loadProjectDataIfNeeded()
	{
		if (this._isReleased || this.isReady || this.loadError)
		{
			return;
		}

		const projectFileName = normaliseProjectFileName(this.projectFileName);
		if (!projectFileName)
		{
			return;
		}

		if (isPromiseLike(this._projectDataPromise))
		{
			return;
		}

		const sdkType = (this as any).objectType;
		if (!sdkType || typeof sdkType._requestProjectDataLoad !== "function")
		{
			this._setLoadError(new Error("Spriter: object type does not support project loading yet."));
			return;
		}

		const loadPromise = sdkType._requestProjectDataLoad(projectFileName);
		if (!isPromiseLike(loadPromise))
		{
			this._setLoadError(new Error("Spriter: failed to start project load."));
			return;
		}

		this._projectDataPromise = loadPromise;

		loadPromise
			.then((projectData: unknown) =>
			{
				if (this._isReleased)
				{
					return;
				}

				this.projectData = projectData;
				this.isReady = true;
				this._triggerOnReady();
			})
			.catch((error: unknown) =>
			{
				if (this._isReleased)
				{
					return;
				}

				this._setLoadError(error);
			});
	}

	_setLoadError(error: unknown)
	{
		this.loadError = error;
		this.isReady = false;
		this.projectData = null;
		this.loadErrorMessage = error instanceof Error ? error.message : String(error);

		if (!this._didTriggerLoadFailed)
		{
			console.error(`[Spriter] Failed to load project '${this.projectFileName}': ${this.loadErrorMessage}`, error);
			this._triggerOnLoadFailed();
		}
	}

	_triggerOnReady()
	{
		if (this._didTriggerReady)
		{
			return;
		}

		this._didTriggerReady = true;

		const cnds = (C3.Plugins.Spriter as any).Cnds;
		if (typeof (this as any)._trigger === "function" && cnds && typeof cnds.OnReady === "function")
		{
			(this as any)._trigger(cnds.OnReady);
		}
	}

	_triggerOnLoadFailed()
	{
		if (this._didTriggerLoadFailed)
		{
			return;
		}

		this._didTriggerLoadFailed = true;

		const cnds = (C3.Plugins.Spriter as any).Cnds;
		if (typeof (this as any)._trigger === "function" && cnds && typeof cnds.OnLoadFailed === "function")
		{
			(this as any)._trigger(cnds.OnLoadFailed);
		}
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
