export function isDuplicateKeyValueError(e: unknown | Error): boolean {
	if (typeof e !== "object" || e === null) return false;
	const _e = (e as Error & {code?: string;}); 
	return _e.code != null ? _e.code === "23505" : _e.message?.startsWith("duplicate key value");
}
