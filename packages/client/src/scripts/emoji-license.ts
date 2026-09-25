/**
 * @packageDocumentation
 *
 * 絵文字のライセンス・コピー可否の選択肢と説明文をまとめたモジュール。
 *
 * @remarks
 * 管理画面（編集ダイアログ・一括ライセンス設定）と、絵文字の追加申請・変更申請の画面で同じ選択肢を使うために置いている。
 * 選択肢を増やすときはここだけを直す。
 * - ライセンス名は DB の licenseName にそのまま保存し、ActivityPub でも名前のまま送る（URL にはしない）。
 * - コピー可否は DB 上の 4 値（allow / deny / conditional / none）だけ。申請画面の「許可の後、コピー可」は
 *   画面だけの選択肢で、保存時は conditional と使用情報の前置き（{@link ASK_BEFORE_COPY_PREFIX}）に変換する。
 *
 * @internal
 */

// #region ライセンス

/**
 * 選択肢として出すライセンス名（並び順どおり）。
 *
 * @remarks
 * 空文字（ライセンスを付けない）と「その他（自由入力）」はこの一覧に含めず、画面側で前後に足す。
 * 名前を変えると既存の絵文字の licenseName と一致しなくなり「その他」扱いになるので、変えるときは注意する。
 */
export const EMOJI_LICENSE_NAMES = [
	"CC0 1.0 Universal",
	"CC BY 4.0",
	"CC BY-NC 4.0",
	"CC BY-NC-SA 4.0",
	"CC BY-NC-ND 4.0",
	"Public Domain",
] as const;

/** 「その他（自由入力）」を選んだことを表す、選択欄だけで使う値 */
export const EMOJI_LICENSE_OTHER = "__other__";

/** ライセンスを付けないときの選択肢の表示名 */
export const EMOJI_LICENSE_NONE_LABEL = "決めない";

/** 「その他（自由入力）」の選択肢の表示名 */
export const EMOJI_LICENSE_OTHER_LABEL = "その他（自由入力）";

/**
 * ライセンスの選択肢ごとの説明文。キーは選択欄の値（空文字 = 付けない、{@link EMOJI_LICENSE_OTHER} = その他）。
 */
export const EMOJI_LICENSE_DESCRIPTIONS: Readonly<Record<string, string>> = {
	"":
		"ライセンスを付けません。ライセンスが無い絵文字は、作者の許可なく使ったり加工したりできない扱いになります。二次創作などで、ライセンスを決められないときもこれを選びます。",
	"CC0 1.0 Universal":
		"作者が全ての権利を行使しないと宣言した状態です。作者の意思で「自由に使ってよい」と明示します。クレジット表示なしで商用・改変ともに自由に使えます。",
	"CC BY 4.0":
		"この絵文字を使用・コピーする際、作者のクレジット表示を条件とします。商用利用も改変も可能です。",
	"CC BY-NC 4.0":
		"この絵文字を使用・コピーする際、作者のクレジット表示が必要で、かつ商用利用は出来ないようにします。改変・二次創作は可能です。",
	"CC BY-NC-SA 4.0":
		"この絵文字を使用・コピーする際、作者のクレジット表示が必要で、かつ商用利用は出来ないようにします。改変・二次創作は可能ですが、改変した作品も CC BY-NC-SA で公開する必要があります。",
	"CC BY-NC-ND 4.0":
		"この絵文字を使用・コピーする際、クレジット表示が必要で、商用利用も改変もできません。そのままの形で使う（表示・配布）事のみ許可するライセンスです。",
	"Public Domain":
		"法律で著作権が切れた、または最初から権利が及ばない状態です。クレジット表示なしで商用・改変ともに自由に使えます。",
	[EMOJI_LICENSE_OTHER]:
		"上記以外のライセンスを使う場合に選び、下の入力欄にライセンス名を記入してください。",
};

/**
 * 保存済みのライセンス名から、選択欄の値を決める。
 *
 * @param name - licenseName（null・空文字なら付けない）
 * @returns 一覧にある名前ならその名前、無ければ {@link EMOJI_LICENSE_OTHER}、空なら空文字
 * @internal
 */
export function resolveLicenseSelectValue(name: string | null | undefined): string {
	if (name == null || name === "") return "";
	return (EMOJI_LICENSE_NAMES as readonly string[]).includes(name)
		? name
		: EMOJI_LICENSE_OTHER;
}

// #endregion

// #region コピー可否

/** DB に保存するコピー可否の値（完全形） */
export const EMOJI_COPY_PERMISSIONS = ["allow", "deny", "conditional", "none"] as const;

export type EmojiCopyPermission = (typeof EMOJI_COPY_PERMISSIONS)[number];

/**
 * 申請画面だけの選択肢「許可の後、コピー可」を表す値。
 *
 * @remarks
 * 保存時は conditional にし、使用情報の先頭に {@link ASK_BEFORE_COPY_PREFIX} と連絡先を付ける（Google フォームの GAS と同じ扱い）。
 * copyPermission は他のサーバーにも配られるので、DB に新しい値は増やさない。
 */
export const COPY_PERMISSION_ASK = "ask";

/** 「許可の後、コピー可」のとき、使用情報の先頭に付ける文 */
export const ASK_BEFORE_COPY_PREFIX = "コピー前に次のユーザの許可を得る事 : ";

/**
 * 申請画面で出すコピー可否の選択肢（並び順どおり）。
 *
 * @remarks
 * 表示名は Google フォームの書き方に合わせている。
 */
export const EMOJI_COPY_PERMISSION_REQUEST_OPTIONS: ReadonlyArray<{
	value: EmojiCopyPermission | typeof COPY_PERMISSION_ASK;
	label: string;
}> = [
	{ value: "none", label: "決めない" },
	{ value: "allow", label: "コピー可" },
	{ value: COPY_PERMISSION_ASK, label: "許可の後、コピー可" },
	{ value: "conditional", label: "条件付きでコピー可" },
	{ value: "deny", label: "コピー不可" },
];

// #endregion
