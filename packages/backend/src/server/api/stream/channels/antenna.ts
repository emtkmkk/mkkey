/**
 * @packageDocumentation
 *
 * アンテナストリーム。アンテナ条件にマッチするノートをリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `antenna`。認証不要（アンテナはユーザーごと）。
 * - antennaId でアンテナを指定し、そのアンテナにヒットするノートを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";
import { Notes } from "@/models/index.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import type { StreamMessages } from "../types.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";

export default class extends Channel {
	public readonly chName = "antenna";
	public static shouldShare = false;
	public static requireCredential = false;
	private antennaId: string;

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onEvent = this.onEvent.bind(this);
	}

	public async init(params: any) {
		this.antennaId = params.antennaId as string;

		// ストリーム購読
		this.subscriber.on(`antennaStream:${this.antennaId}`, this.onEvent);
	}

	private async onEvent(data: StreamMessages["antenna"]["payload"]) {
		if (data.type === "note") {
			try {
				const note = await Notes.pack(data.body.id, this.user, {
					detail: true,
				});

				// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
				if (isUserRelated(note, this.muting)) return;
				if (
					!(note.renote && note.text == null) &&
					this.noteMuting.has(note.userId)
				)
					return;
				// note ミュート: 返信先・RT先の投稿内容が見える場合も除外
				if (note.renote && this.noteMuting.has(note.renote.userId)) return;
				if (note.reply && this.noteMuting.has(note.reply.userId)) return;
				// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
				if (isUserRelated(note, this.blocking)) return;

				if (note.renote && !note.text && isUserRelated(note, this.renoteMuting))
					return;

				this.connection.cacheNote(note);

				this.send("note", note);
			} catch (e) {
				if (
					e instanceof IdentifiableError &&
					e.id === "9725d0ce-ba28-4dde-95a7-2cbb2c15de24"
				) {
					// スキップ: ユーザーにノートが非表示
					return;
				} else {
					throw e;
				}
			}
		} else {
			this.send(data.type, data.body);
		}
	}

	public dispose() {
		// イベント購読解除
		this.subscriber.off(`antennaStream:${this.antennaId}`, this.onEvent);
	}
}
