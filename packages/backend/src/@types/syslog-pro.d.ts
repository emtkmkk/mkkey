/**
 * syslog-pro の最小限の型宣言。
 *
 * @remarks
 * 公式の型定義（@types/syslog-pro）が存在しないため、services/logger.ts で使う範囲だけを宣言する。
 * 送信メソッドは Promise で送信済みメッセージ文字列を返す（ライブラリ実装に合わせる）。
 * 設定項目はライブラリ側の変更に追従しづらいので、緩く `Record<string, unknown>` で受ける。
 *
 * @internal
 */
declare module "syslog-pro" {
	/** RFC 5424 形式で送るクライアント */
	export class RFC5424 {
		constructor(options?: Record<string, unknown>);
		emergency(message: string): Promise<string>;
		alert(message: string): Promise<string>;
		critical(message: string): Promise<string>;
		error(message: string): Promise<string>;
		warning(message: string): Promise<string>;
		notice(message: string): Promise<string>;
		info(message: string): Promise<string>;
		debug(message: string): Promise<string>;
	}
}
