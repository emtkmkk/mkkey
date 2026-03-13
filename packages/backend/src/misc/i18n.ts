/**
 * @packageDocumentation
 *
 * ロケールオブジェクトを保持し、キーによる翻訳文字列取得を提供する。
 *
 * @remarks
 * - **役割**: API エラーメッセージやクライアント向け文言の多言語化に利用する。
 *
 * @internal
 */
export class I18n<T extends Record<string, any>> {
	public locale: T;

	constructor(locale: T) {
		this.locale = locale;

		//#region バインド
		this.t = this.t.bind(this);
		//#endregion
	}

	/**
	 * キー（ドット区切りパス可）で翻訳文字列を取得する。{key} は args で置換される。
	 * @param key - ロケール内のパス
	 * @param args - プレースホルダ置換用のキー・値
	 * @internal
	 */
	public t(key: string, args?: Record<string, any>): string {
		try {
			let str = key.split(".").reduce((o, i) => o[i], this.locale) as string;

			if (args) {
				for (const [k, v] of Object.entries(args)) {
					str = str.replace(`{${k}}`, v);
				}
			}
			return str;
		} catch (e) {
			console.warn(`missing localization '${key}'`);
			return key;
		}
	}
}
