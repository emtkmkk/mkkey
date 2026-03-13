/**
 * @packageDocumentation
 *
 * 未読ノート挿入サービス。
 *
 * @remarks
 * - **役割**: ノート配送時に未読レコードを挿入する。insertNoteUnread は単一ユーザ向け、insertNoteUnreadBatch は複数ユーザを一括で挿入する。
 *
 * @internal
 */
import type { Note } from "@/models/entities/note.js";
import { publishMainStream } from "@/services/stream.js";
import type { User } from "@/models/entities/user.js";
import { Mutings, NoteThreadMutings, NoteUnreads } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { In } from "typeorm";

export type NoteUnreadCandidate = {
	userId: User["id"];
	isSpecified: boolean;
	isMentioned: boolean;
};

/**
 * 複数ユーザに対して未読を一括挿入する。
 * 挿入候補を渡し、Mutings / NoteThreadMutings を一括取得してスキップした上で一括 insert する。
 *
 * @param note - 対象ノート
 * @param candidates - 挿入候補（channel フォロワー・指定ユーザ・メンション先など）
 * @internal
 */
export async function insertNoteUnreadBatch(
	note: Note,
	candidates: NoteUnreadCandidate[],
): Promise<void> {
	if (candidates.length === 0) return;

	const userIds = [...new Set(candidates.map((c) => c.userId))];
	const [mutingRows, threadMuteRows] = await Promise.all([
		Mutings.find({
			where: { muterId: In(userIds), muteeId: note.userId },
			select: ["muterId"],
		}),
		NoteThreadMutings.find({
			where: {
				userId: In(userIds),
				threadId: note.threadId || note.id,
			},
			select: ["userId"],
		}),
	]);
	const mutedSet = new Set(mutingRows.map((r) => r.muterId));
	const threadMutedSet = new Set(threadMuteRows.map((r) => r.userId));
	const toInsert = candidates.filter(
		(c) => !mutedSet.has(c.userId) && !threadMutedSet.has(c.userId),
	);
	if (toInsert.length === 0) return;

	const unreadRecords = toInsert.map((c) => ({
		id: genId(),
		noteId: note.id,
		userId: c.userId,
		isSpecified: c.isSpecified,
		isMentioned: c.isMentioned,
		noteChannelId: note.channelId,
		noteUserId: note.userId,
	}));
	await NoteUnreads.insert(unreadRecords);

	for (const rec of unreadRecords) {
		setTimeout(async () => {
			const exist = await NoteUnreads.findOneBy({ id: rec.id });
			if (exist == null) return;
			if (rec.isMentioned) {
				publishMainStream(rec.userId, "unreadMention", note.id);
			}
			if (rec.isSpecified) {
				publishMainStream(rec.userId, "unreadSpecifiedNote", note.id);
			}
			if (note.channelId) {
				publishMainStream(rec.userId, "unreadChannel", note.id);
			}
		}, 2000);
	}
}

export async function insertNoteUnread(
	userId: User["id"],
	note: Note,
	params: {
		// NOTE: isSpecifiedがtrueならisMentionedは必ずfalse
		isSpecified: boolean;
		isMentioned: boolean;
	},
) {
	//#region ミュートしているなら無視
	// TODO: 現在の仕様ではChannelにミュートは適用されないのでよしなにケアする
	const isMuted = await Mutings.exist({
		where: {
			muterId: userId,
			muteeId: note.userId,
		},
	});
	if (isMuted) return;
	//#endregion

	// スレッドミュート
	const threadMute = await NoteThreadMutings.findOneBy({
		userId: userId,
		threadId: note.threadId || note.id,
	});
	if (threadMute) return;

	const unread = {
		id: genId(),
		noteId: note.id,
		userId: userId,
		isSpecified: params.isSpecified,
		isMentioned: params.isMentioned,
		noteChannelId: note.channelId,
		noteUserId: note.userId,
	};

	await NoteUnreads.insert(unread);

	// 2秒経っても既読にならなかったら「未読の投稿がありますよ」イベントを発行する
	setTimeout(async () => {
		const exist = await NoteUnreads.findOneBy({ id: unread.id });

		if (exist == null) return;

		if (params.isMentioned) {
			publishMainStream(userId, "unreadMention", note.id);
		}
		if (params.isSpecified) {
			publishMainStream(userId, "unreadSpecifiedNote", note.id);
		}
		if (note.channelId) {
			publishMainStream(userId, "unreadChannel", note.id);
		}
	}, 2000);
}
