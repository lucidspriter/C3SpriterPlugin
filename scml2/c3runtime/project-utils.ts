export function normaliseProjectFileName(fileName: unknown): string
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

export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T>
{
	return !!(value && typeof (value as PromiseLike<T>).then === "function");
}

