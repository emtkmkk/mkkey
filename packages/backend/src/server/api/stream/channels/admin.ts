/**
 * @packageDocumentation
 *
 * 管理者用ストリーム。管理者向けのシステムイベントを配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `admin`。認証必須（管理者のみ）。
 * - adminStream を購読し、管理者向けのイベントを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";

export default class extends Channel {
	public readonly chName = "admin";
	public static shouldShare = true;
	public static requireCredential = true;

	public async init(params: any) {
		// 管理者ストリームを購読
		this.subscriber.on(`adminStream:${this.user!.id}`, (data) => {
			this.send(data);
		});
	}
}
