export function normaliseProjectFileName(fileName)
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

export function isPromiseLike(value)
{
        return !!(value && typeof value.then === "function");
}
