const C3 = globalThis.C3;

C3.Plugins.Spriter.Acts =
{
        setAnimation(animationName, startFrom = 0, blendDuration = 0)
        {
                const targetName = (typeof animationName === "string") ? animationName : toStringOrEmpty(animationName);
                const numericStartFrom = Number(startFrom);
                const resolvedStartFrom = Number.isFinite(numericStartFrom) ? numericStartFrom : 0;
                const numericBlendDuration = Number(blendDuration);
                const resolvedBlendDuration = Number.isFinite(numericBlendDuration) ? numericBlendDuration : 0;

                if (typeof this._setAnimation === "function")
                {
                        this._setAnimation(targetName, resolvedStartFrom, resolvedBlendDuration);
                        return;
                }

                if (typeof console !== "undefined" && console && typeof console.warn === "function")
                {
                        console.warn("[Spriter] Attempted to set an animation before the runtime initialised the playback system." );
                }
        }
};

function toStringOrEmpty(value)
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
