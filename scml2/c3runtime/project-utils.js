export function normaliseProjectFileName(fileName)
{
	if (typeof fileName !== "string")
	{
		return "";
	}

	let normalised = fileName.trim().toLowerCase();

	// Legacy projects may still reference the original .scml. The runtime MVP will load .scon (JSON)
	// so normalise the extension for lookups and caching.
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

