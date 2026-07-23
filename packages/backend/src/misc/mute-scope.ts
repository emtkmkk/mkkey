/**
 * @packageDocumentation
 *
 * ユーザー単位ミュートの対象範囲を、DB用ビットマスクとAPI用文字列の間で変換する。
 *
 * @remarks
 * `all` は従来の通常ミュートを表す特別なビットで、個別範囲より常に優先される。
 * DBクエリでは {@link createMuteScopeCondition} を利用し、判定条件のずれを防ぐ。
 *
 * @internal
 */

/** ユーザー単位ミュートで選択できる範囲。 */
export const muteTypes = [
	"all",
	"note",
	"renote",
	"notification",
	"push",
	"reaction",
	"message",
	"follow",
] as const;

/**
 * ユーザー単位ミュートの範囲名。
 *
 * @public
 */
export type MuteType = (typeof muteTypes)[number];

/**
 * ミュート範囲ごとのDB保存ビット。
 *
 * @remarks
 * 既存ミュートの移行値と互換性を保つため、割り当て済みの値は変更しない。
 *
 * @internal
 */
export const MUTE_SCOPE_BITS: Readonly<Record<MuteType, number>> = {
	all: 1 << 0,
	note: 1 << 1,
	renote: 1 << 2,
	notification: 1 << 3,
	push: 1 << 4,
	reaction: 1 << 5,
	message: 1 << 6,
	follow: 1 << 7,
};

/** API入力が有効なミュート範囲名か判定する。 */
export function isMuteType(value: string): value is MuteType {
	return (muteTypes as readonly string[]).includes(value);
}

/**
 * API用の範囲配列をDB用ビットマスクへ変換する。
 *
 * @param types - 選択されたミュート範囲
 * @returns DBへ保存するビットマスク
 *
 * @remarks
 * `all` が含まれる場合は他の指定を捨て、従来ミュートの特別ビットだけを返す。
 *
 * @internal
 */
export function encodeMuteTypes(types: readonly MuteType[]): number {
	if (types.includes("all")) {
		return MUTE_SCOPE_BITS.all;
	}

	return [...new Set(types)].reduce(
		(scope, type) => scope | MUTE_SCOPE_BITS[type],
		0,
	);
}

/**
 * DB用ビットマスクをAPI用の範囲配列へ変換する。
 *
 * @param scope - DBに保存されたビットマスク
 * @returns APIへ返すミュート範囲
 * @internal
 */
export function decodeMuteScope(scope: number): MuteType[] {
	if ((scope & MUTE_SCOPE_BITS.all) !== 0) {
		return ["all"];
	}

	return muteTypes.filter(
		(type) => type !== "all" && (scope & MUTE_SCOPE_BITS[type]) !== 0,
	);
}

/**
 * ビットマスクが指定範囲または従来ミュートを含むか判定する。
 *
 * @param scope - DBに保存されたビットマスク
 * @param type - 確認する個別範囲
 * @returns 対象範囲が有効ならtrue
 * @public
 */
export function hasMuteScope(scope: number, type: Exclude<MuteType, "all">): boolean {
	return (
		(scope & MUTE_SCOPE_BITS.all) !== 0 ||
		(scope & MUTE_SCOPE_BITS[type]) !== 0
	);
}

/**
 * QueryBuilderで利用する範囲判定SQLを生成する。
 *
 * @param alias - ミュートテーブルのSQLエイリアス
 * @param type - 確認する個別範囲
 * @returns `all` または指定範囲に一致するSQL条件
 *
 * @remarks
 * エイリアスはコード内定数だけを渡す。利用者入力を渡してはならない。
 *
 * @internal
 */
export function createMuteScopeCondition(
	alias: string,
	type: Exclude<MuteType, "all">,
): string {
	return `((${alias}."scope" & ${MUTE_SCOPE_BITS.all}) <> 0 OR (${alias}."scope" & ${MUTE_SCOPE_BITS[type]}) <> 0)`;
}
