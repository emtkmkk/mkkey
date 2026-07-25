/**
 * @packageDocumentation
 *
 * ハッシュタグストリーム。指定タグ付きノートをリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `hashtag`。認証不要。
 * - クエリでタグを指定し、そのタグが付いたノートを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";
import { normalizeForSearch } from "@/misc/normalize-for-search.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import type { Packed } from "@/misc/schema.js";

export default class extends Channel {
	public readonly chName = "hashtag";
	public static shouldShare = false;
	public static requireCredential = false;
	private q: string[][];

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onNote = this.withPackedNote(this.onNote.bind(this));
	}

	public async init(params: any) {
		this.q = params.q;

		if (this.q == null) return;

		// ストリーム購読
		this.subscriber.on("notesStream", this.onNote);
	}

	private async onNote(note: Packed<"Note">) {
		if (note.visibility === "hidden") return;
		const noteTags = note.tags
			? note.tags.map((t: string) => t.toLowerCase())
			: [];
		const matched = this.q.some((tags) =>
			tags.every((tag) => noteTags.includes(normalizeForSearch(tag))),
		);
		if (!matched) return;

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.muting)) return;
		if (!(note.renote && note.text == null) && this.noteMuting.has(note.userId))
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
	}

	public dispose() {
		// イベント購読解除
		this.subscriber.off("notesStream", this.onNote);
	}
}
