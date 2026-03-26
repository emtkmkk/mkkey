/**
 * @packageDocumentation
 *
 * ローカルタイムラインストリーム。自インスタンスのパブリックノートをリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `localTimeline`。認証不要。
 * - notesStream を購読し、ローカルタイムラインに流れるノートを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getWordHardMute } from "@/misc/check-word-mute.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import type { Packed } from "@/misc/schema.js";

const RECENT_RENOTE_TARGET_LIMIT = 128;

function hasRenoteOnlyContent(note: Packed<"Note">): boolean {
        if (!note.text && (!note.files || note.files.length === 0) && !note.poll) {
                return false;
        }

        if (note.text && note.text.trim().length > 0) {
                return true;
        }

        if (note.files && note.files.length > 0) {
                return true;
        }

        if (note.poll) {
                return true;
        }

        return false;
}

function isRenoteOnly(note: Packed<"Note">): boolean {
        if (!note.renote) return false;

        return !hasRenoteOnlyContent(note);
}

function rememberRecentId(targets: Set<string>, id: string): void {
        if (targets.has(id)) {
                targets.delete(id);
        }

        targets.add(id);

        if (targets.size > RECENT_RENOTE_TARGET_LIMIT) {
                const oldestId = targets.values().next().value;
                if (oldestId !== undefined) {
                        targets.delete(oldestId);
                }
        }
}

export default class extends Channel {
        public readonly chName = "localTimeline";
        public static shouldShare = true;
        public static requireCredential = false;
        private withBelowPublic: boolean;
        private showReplyMode: "all" | "notBotOnly" | "personalOnly";
        private receivedRenoteTargetIds: Set<string> = new Set();
        private displayedNoteIds: Set<string> = new Set();

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

		this.showReplyMode = params?.showReplyMode || "all";

		// イベント購読
		this.subscriber.on("notesStream", this.onNote);
	}

	private async onNote(note: Packed<"Note">) {
		const meta = await fetchMeta();
		if (
			note.user.host !== null &&
			!meta.recommendedInstances.includes(
				note.user.host,
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
		if (note.replyId != null && !(note.reply?.user.host == null || meta.recommendedInstances.includes(note.reply?.user.host))) return;

		// 関係ない返信は除外（showReplyMode が notBotOnly のときのみ isBotMention も同様に除外、自分の投稿は除く）
		if (!this.user && note.reply) {
			return;
		}
		if (this.user && this.showReplyMode === "notBotOnly" && note.isBotMention && note.userId !== this.user.id) {
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
			if (reply.userId !== this.user!.id && note.userId !== this.user!.id && (this.showReplyMode === "notBotOnly" && (reply.user.isBot || note.user.isBot || note.isBotMention))) return;
			if (
				reply.userId !== this.user!.id && note.userId !== this.user!.id && (this.showReplyMode === "personalOnly" || !replyFollowing)
			) return;
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

                if (isRenoteOnly(note) && this.shouldSkipRenoteOnly(note)) {
                        return;
                }

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
                this.rememberDisplayedNote(note);

                if (isRenoteOnly(note)) {
                        this.rememberRenoteOnly(note);
                }

                this.send("note", note);
        }

        public dispose() {
                // イベント購読解除
                this.subscriber.off("notesStream", this.onNote);
        }

        private shouldSkipRenoteOnly(note: Packed<"Note">): boolean {
                if (!isRenoteOnly(note)) return false;

                const targetId = note.renote?.id;
                if (!targetId) return false;

                return (
                        this.displayedNoteIds.has(targetId) ||
                        this.receivedRenoteTargetIds.has(targetId)
                );
        }


        private rememberDisplayedNote(note: Packed<"Note">) {
                rememberRecentId(this.displayedNoteIds, note.id);
        }

        private rememberRenoteOnly(note: Packed<"Note">) {
                const targetId = note.renote?.id;
                if (!targetId) return;

                rememberRecentId(this.receivedRenoteTargetIds, targetId);
        }
}
