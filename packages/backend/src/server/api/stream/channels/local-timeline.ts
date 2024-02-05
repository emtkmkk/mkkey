import Channel from "../channel.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getWordHardMute } from "@/misc/check-word-mute.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import type { Packed } from "@/misc/schema.js";

export default class extends Channel {
	public readonly chName = "localTimeline";
	public static shouldShare = true;
	public static requireCredential = false;
	private withBelowPublic: boolean;

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onNote = this.withPackedNote(this.onNote.bind(this));
	}

	public async init(params: any) {
		const meta = await fetchMeta();
		if (meta.disableLocalTimeline) {
			if (this.user == null || !(this.user.isAdmin || this.user.isModerator))
				return;
		}

		this.withBelowPublic = params?.withBelowPublic || false;

		// Subscribe events
		this.subscriber.on("notesStream", this.onNote);
	}

	private async onNote(note: Packed<"Note">) {
		const meta = await fetchMeta();
		if (
			note.user.host !== null &&
			!meta.recommendedInstances.includes(
				`${note.user.username}@${note.user.host}`,
			)
		)
			return;
		if (!this.withBelowPublic && note.visibility !== "public") return;
		if (
			note.visibility !== "public" &&
			this.user!.id !== note.userId &&
			!this.following.has(note.userId)
		)
			return;
		if (note.replyId != null && note.reply?.user.host != null) return;

		// 関係ない返信は除外
		if (!this.user && note.reply) {
			return;
		}
		if (note.reply && !this.user!.showTimelineReplies) {
			const reply = note.reply;
			// 「フォロー中同士の会話」でもなければ、「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信（ただし一つ上の投稿へ遡る）」でもない場合
			let replyFollowing =
				reply.userId === note.userId ||
				(this.following.has(reply.userId) && this.following.has(note.userId));
			if (reply.reply && reply.userId === note.userId) {
				replyFollowing =
					reply.reply.userId === note.userId ||
					(this.following.has(reply.reply.userId) &&
						this.following.has(note.userId));
			}
			if (
				!replyFollowing &&
				reply.userId !== this.user!.id &&
				note.userId !== this.user!.id
			)
				return;
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.muting)) return;
		// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.blocking)) return;

		if (note.renote && !note.text && isUserRelated(note, this.renoteMuting))
			return;
		if (
			note.renote &&
			!note.text &&
			(!this.user || !this.user!.localShowRenote)
		)
			return;

		// 流れてきたNoteがミュートすべきNoteだったら無視する
		// TODO: 将来的には、単にMutedNoteテーブルにレコードがあるかどうかで判定したい(以下の理由により難しそうではある)
		// 現状では、ワードミュートにおけるMutedNoteレコードの追加処理はストリーミングに流す処理と並列で行われるため、
		// レコードが追加されるNoteでも追加されるより先にここのストリーミングの処理に到達することが起こる。
		// そのためレコードが存在するかのチェックでは不十分なので、改めてgetWordHardMuteを呼んでいる
		if (
			this.userProfile &&
			(await getWordHardMute(note, this.user, this.userProfile.mutedWords))
		)
			return;

		this.connection.cacheNote(note);

		this.send("note", note);
	}

	public dispose() {
		// Unsubscribe events
		this.subscriber.off("notesStream", this.onNote);
	}
}
