import Channel from "../channel.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getWordHardMute } from "@/misc/check-word-mute.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import type { Packed } from "@/misc/schema.js";

export default class extends Channel {
	public readonly chName = "spotlightTimeline";
	public static shouldShare = true;
	public static requireCredential = false;

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

		// Subscribe events
		this.subscriber.on("notesStream", this.onNote);
	}

	private async onNote(note: Packed<"Note">) {
		const meta = await fetchMeta();

		let dynamicScore1 = 40;		// フォロー済のユーザが出現するScore閾値
		let dynamicScore2 = 120;	// ローカルユーザが出現するScore閾値
		let dynamicScore3 = 200;	// リモートユーザが出現するScore閾値

		if(this.user!.followingCount < 50){
			dynamicScore1 = 20;
			dynamicScore2 = 36;
			dynamicScore3 = 100;
		}else if(this.user!.followingCount < 500){
			dynamicScore1 = 30;
			dynamicScore2 = 60;
			dynamicScore3 = 150;
		}

		// TODO : うまく行かないと拾えないのを直す
		dynamicScore1 = Math.floor(dynamicScore1 / 3);
		dynamicScore2 = Math.floor(dynamicScore2 / 3);
		dynamicScore3 = Math.floor(dynamicScore3 / 3);

		if (!note.renoteId) return;

		if (!(
			(note.channelId == null && this.following.has(note.renote!.userId) && Math.floor(note.renote!.score / 3) === dynamicScore1)||
			(note.channelId == null && !note.renote!.user.host && Math.floor(note.renote!.score / 3) === dynamicScore2) ||
			(note.channelId == null && note.renote!.user.host && Math.floor(note.renote!.score / 3) === dynamicScore3))
		) return;

		if (note.visibility !== "public") return;

		// 関係ない返信は除外
		if (!this.user && note.reply){
 			return
		}
		if (note.reply && !this.user!.showTimelineReplies) {
			const reply = note.reply;
			// 「フォロー中同士の会話」でもなければ、「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信（ただし一つ上の投稿へ遡る）」でもない場合
			let replyFollowing = reply.userId === note.userId || this.following.has(reply.userId) && this.following.has(note.userId);
			if (reply.reply && reply.userId === note.userId) {
				replyFollowing = reply.reply.userId === note.userId || this.following.has(reply.reply.userId) && this.following.has(note.userId);
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

		if (note.renote && !note.text && (!this.user || !this.user!.localShowRenote))
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
