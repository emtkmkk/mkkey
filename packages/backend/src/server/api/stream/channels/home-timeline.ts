/**
 * @packageDocumentation
 *
 * ホームタイムラインストリーム。フォロー先のノートをリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `homeTimeline`。認証必須。
 * - notesStream を購読し、ホームタイムラインに流れるノートを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";
import { getWordHardMute } from "@/misc/check-word-mute.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import { isInstanceMuted } from "@/misc/is-instance-muted.js";
import type { Packed } from "@/misc/schema.js";

export default class extends Channel {
	public readonly chName = "homeTimeline";
	public static shouldShare = true;
	public static requireCredential = true;

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onNote = this.withPackedNote(this.onNote.bind(this));
	}

	public async init(params: any) {
		// イベント購読
		this.subscriber.on("notesStream", this.onNote);
	}

	private async onNote(note: Packed<"Note">) {
		if (note.visibility === "hidden") return;
		if (note.channelId) {
			// フォローしているチャンネルの場合は全員取得する
			if (
				!this.followingChannels.has(note.channelId) &&
				this.user!.id !== note.userId &&
				!this.following.has(note.userId)
			)
				return;
		} else {
			// その投稿のユーザーをフォローしていなかったら弾く
			if (this.user!.id !== note.userId && !this.following.has(note.userId))
				return;
		}

		// ユーザーがミュートしたインスタンスのノートは無視
		if (
			isInstanceMuted(
				note,
				new Set<string>(this.userProfile?.mutedInstances ?? []),
			)
		)
			return;

		// 関係ない返信は除外
		if (
			note.reply &&
			this.user != null &&
			this.user.showTimelineReplies !== true
		) {
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

		if (
			note.renote &&
			this.user != null &&
			this.user.showSelfRenoteToHome === false &&
			!note.text &&
			this.user.id !== note.userId &&
			note.renote.userId === note.userId
		)
			return;

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
		// イベント購読解除
		this.subscriber.off("notesStream", this.onNote);
	}
}
