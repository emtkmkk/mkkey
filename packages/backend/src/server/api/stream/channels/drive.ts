/**
 * @packageDocumentation
 *
 * ドライブストリーム。ドライブのファイル追加・更新等のイベントを配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `drive`。認証必須。
 * - driveStream を購読し、認証ユーザーのドライブイベントを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";

export default class extends Channel {
	public readonly chName = "drive";
	public static shouldShare = true;
	public static requireCredential = true;

	public async init(params: any) {
		// ドライブストリームを購読
		this.subscriber.on(`driveStream:${this.user!.id}`, (data) => {
			this.send(data);
		});
	}
}
