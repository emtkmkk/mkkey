const UNSAFE_SQL_PATTERN = /[\0\x08\x09\x1a\n\r"'\\%]/;

export function safeForSql(text: string): boolean {
        return !UNSAFE_SQL_PATTERN.test(text);
}
