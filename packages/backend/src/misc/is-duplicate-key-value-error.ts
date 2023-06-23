export function isDuplicateKeyValueError(e: unknown | Error): boolean {
	return (e as Error & {code?: string;}).code === "23505";
}
