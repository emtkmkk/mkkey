/**
 * @packageDocumentation
 *
 * おすすめタイムラインストリーム。アルゴリズムによるおすすめノートをリアルタイム配送。
 *
 * @remarks
 * - **ストリーム チャンネル名**: `recommendedTimeline`。認証必須。
 * - notesStream を購読し、おすすめタイムラインに流れるノートを配送する。
 *
 * @see {@link stream/channel} チャンネル基底
 * @internal
 */
import Channel from "../channel.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { getWordHardMute } from "@/misc/check-word-mute.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import { isInstanceMuted } from "@/misc/is-instance-muted.js";
import type { Packed } from "@/misc/schema.js";

/**
 * ストリーム配信で投票終了間近とみなす時間窓（3時間）
 *
 * @remarks
 * NOTE: API の `notes/recommended-timeline` と同じ「終了3時間以内」条件を維持する。
 *
 * @internal
 */
const POLL_ENDING_SOON_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * 公開投票が終了3時間以内か判定する。
 *
 * @param note 判定対象のノート
 * @returns 公開投票で終了まで3時間以内かつ未終了なら true
 * @remarks
 * NOTE: ストリームでは DB クエリを使わないため、pack 済みノートの poll 情報から判定する。
 * @internal
 */
function isExpiringSoonPublicPoll(note: Packed<"Note">): boolean {
	if (note.visibility !== "public" || !note.poll?.expiresAt) return false;

	const pollExpiresAt = new Date(note.poll.expiresAt);
	if (Number.isNaN(pollExpiresAt.getTime())) return false;

	const now = new Date();
	const pollWindowEnd = new Date(now.getTime() + POLL_ENDING_SOON_WINDOW_MS);
	return pollExpiresAt > now && pollExpiresAt <= pollWindowEnd;
}

/**
 * 接続ユーザーが投票済みかを判定する。
 *
 * @param note 判定対象のノート
 * @returns いずれかの選択肢に isVoted=true があれば true
 * @remarks
 * NOTE: pack 済み poll は選択肢ごとに `isVoted` を持つため、追加クエリなしで判定できる。
 * @internal
 */
function hasCurrentUserVoted(note: Packed<"Note">): boolean {
	if (!note.poll?.choices?.length) return false;
	return note.poll.choices.some((choice) => choice.isVoted === true);
}

export default class extends Channel {
	public readonly chName = "recommendedTimeline";
	public static shouldShare = true;
	public static requireCredential = true;
	private showReplyMode: "all" | "notBotOnly" | "personalOnly"

	constructor(id: string, connection: Channel["connection"]) {
		super(id, connection);
		this.onNote = this.withPackedNote(this.onNote.bind(this));
	}

	public async init(params: any) {
		const meta = await fetchMeta();
		if (
			meta.disableRecommendedTimeline &&
			!this.user!.isAdmin &&
			!this.user!.isModerator
		)
			return;

		this.showReplyMode = params?.showReplyMode || "all";

		// イベント購読
		this.subscriber.on("notesStream", this.onNote);
	}

	private async onNote(note: Packed<"Note">) {
		if (note.visibility === "hidden") return;
		//#region おすすめ候補条件
		const meta = await fetchMeta();
		const hasRecommendedFileContent =
			(note.fileIds && note.fileIds.length !== 0) ||
			(note.renote &&
				!note.text &&
				note.renote.fileIds &&
				note.renote.fileIds.length !== 0);
		// NOTE: フォロー中・非bot・公開・終了3時間以内の投票を、おすすめ候補として加算する。
		const hasFollowedNonBotExpiringPoll =
			this.following.has(note.userId) &&
			note.user.isBot !== true &&
			isExpiringSoonPublicPoll(note) &&
			!hasCurrentUserVoted(note);
		if (
			!(
				(hasRecommendedFileContent || hasFollowedNonBotExpiringPoll) &&
				note.visibility === "public"
			)
		)
			return;
		//#endregion

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

		if (
			note.renote &&
			!note.text &&
			!note.user.host &&
			this.user != null &&
			this.user.localShowRenote === false
		)
			return;
		if (
			note.renote &&
			!note.text &&
			note.user.host &&
			this.user != null &&
			this.user.remoteShowRenote === false
		)
			return;

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
