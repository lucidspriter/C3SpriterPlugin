const C3 = globalThis.C3;

C3.Plugins.Spriter.Instance = class SpriterInstance extends globalThis.ISDKWorldInstanceBase
{
        constructor()
        {
                super();

                const properties = this._getInitProperties();
                this._initialProperties = properties ? [...properties] : [];

                // TODO: initialise Spriter runtime state once ported to SDK v2.
        }

        _release()
        {
                super._release();
        }

        _onCreate()
        {
                // TODO: create runtime resources for the Spriter instance.
        }

        _onDestroy()
        {
                // TODO: clean up resources created during _onCreate.
        }

        _draw(renderer)
        {
                // TODO: render the Spriter animation once the runtime is implemented.
        }

        _tick()
        {
                // TODO: advance animation state each frame.
        }

        _saveToJson()
        {
                return {
                        // TODO: persist state for savegames.
                };
        }

        _loadFromJson(o)
        {
                // TODO: restore state from savegames.
        }

        _getDebuggerProperties()
        {
                return [];
        }
};
