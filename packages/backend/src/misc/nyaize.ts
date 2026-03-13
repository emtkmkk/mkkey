/**
 * @packageDocumentation
 *
 * テキストを「にゃ」系に変換する（日本語・英語・韓国語対応）。
 *
 * @remarks
 * - **役割**: ノート本文や表示名の変換に用い、クライアント設定でにゃ語表示する際に利用する。
 *
 * @internal
 */
/**
 * テキストをにゃ語調に変換する。
 * @param text - 入力文字列
 * @returns 変換後の文字列
 * @internal
 */
export function nyaize(text: string): string {
	return (
		text
			.replaceAll("な", "にゃ")
			.replaceAll("ナ", "ニャ")
			.replaceAll("ﾅ", "ﾆｬ")
			.replace(/(?<=n)a/gi, (x) => (x === "A" ? "YA" : "ya"))
			.replace(/(?<=morn)ing/gi, (x) => (x === "ING" ? "YAN" : "yan"))
			.replace(/(?<=every)one/gi, (x) => (x === "ONE" ? "NYAN" : "nyan"))
			.replace(/[나-낳]/g, (match) =>
				String.fromCharCode(
					match.charCodeAt(0)! + "냐".charCodeAt(0) - "나".charCodeAt(0),
				),
			)
			.replace(/(다$)|(다(?=\.))|(다(?= ))|(다(?=!))|(다(?=\?))/gm, "다냥")
			.replace(/(야(?=\?))|(야$)|(야(?= ))/gm, "냥")
	);
}
