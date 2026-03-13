/**
 * @packageDocumentation
 *
 * メッセージ一覧ストリーム。DM・グループ一覧の更新イベントを配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `messagingIndex`。認証必須。
 * - messagingIndexStream を購読し、メッセージ一覧の更新を配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";

export default class extends Channel {
	public readonly chName = "messagingIndex";
	public static shouldShare = true;
	public static requireCredential = true;

	public async init(params: any) {
		// メッセージ一覧ストリームを購読
		this.subscriber.on(`messagingIndexStream:${this.user!.id}`, (data) => {
			this.send(data);
		});
	}
}
