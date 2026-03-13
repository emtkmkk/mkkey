/**
 * @packageDocumentation
 *
 * メインストリーム（通知・メンション等）。認証ユーザー向けの共通イベント。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `main`。認証必須。
 * - 通知・メンション・その他 mainStream で配送されるイベントを受信する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";
import {
	isInstanceMuted,
	isUserFromMutedInstance,
} from "@/misc/is-instance-muted.js";

export default class extends Channel {
	public readonly chName = "main";
	public static shouldShare = true;
	public static requireCredential = true;

	public async init(params: any) {
		// メインストリームチャンネルを購読
		this.subscriber.on(`mainStream:${this.user!.id}`, async (data) => {
			switch (data.type) {
				case "notification": {
					// ユーザーがミュートしたインスタンスからの通知は無視
					if (
						isUserFromMutedInstance(
							data.body,
							new Set<string>(this.userProfile?.mutedInstances ?? []),
						)
					)
						return;
					if (data.body.userId && this.muting.has(data.body.userId)) return;

					break;
				}
				case "mention": {
					if (
						isInstanceMuted(
							data.body,
							new Set<string>(this.userProfile?.mutedInstances ?? []),
						)
					)
						return;

					if (this.muting.has(data.body.userId)) return;
					break;
				}
			}

			this.send(data.type, data.body);
		});
	}
}
