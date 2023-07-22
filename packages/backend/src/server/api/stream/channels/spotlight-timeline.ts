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
		
		let DynamicRenoteCount1 = 10;
		let DynamicRenoteCount2 = 40;
		let DynamicRenoteCount3 = 60;
		if(this.user!.followersCount < 50){
			DynamicRenoteCount1 = 5;
			DynamicRenoteCount2 = 10;
			DynamicRenoteCount3 = 20;
		}else if(this.user!.followersCount < 500){
			DynamicRenoteCount2 = 20;
			DynamicRenoteCount3 = 30;
		}
		
		if (!(
			(note.channelId == null && this.following.has(note.renote!.userId) && note.renote!.renoteCount == DynamicRenoteCount1 && note.renoteId != null)||
			(note.channelId == null && note.renote!.renoteCount == DynamicRenoteCount2 && note.user.host == null && note.renoteId != null)||
			(note.channelId == null && note.renote!.renoteCount == DynamicRenoteCount3 && note.renoteId != null))
		) return;
		
		if (note.visibility !== "public") return;

		// 関係ない返信は除外
		if (note.reply && !this.user!.showTimelineReplies) {
			const reply = note.reply;
			// 「チャンネル接続主への返信」でもなければ、「チャンネル接続主が行った返信」でもなければ、「投稿者の投稿者自身への返信」でもない場合
			if (
				reply.userId !== this.user!.id &&
				note.userId !== this.user!.id &&
				reply.userId !== note.userId
			)
				return;
		}

		// 流れてきたNoteがミュートしているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.muting)) return;
		// 流れてきたNoteがブロックされているユーザーが関わるものだったら無視する
		if (isUserRelated(note, this.blocking)) return;

		if (note.renote && !note.text && isUserRelated(note, this.renoteMuting))
			return;
		
		if (note.renote && !note.text && !this.user!.localShowRenote)
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