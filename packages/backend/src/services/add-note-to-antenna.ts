/**
 * @packageDocumentation
 *
 * アンテナにノートを追加するサービス。
 *
 * @remarks
 * - **役割**: ノート作成時等で、条件に合うアンテナにノートを登録し、ストリーム・通知・Webhook を発火する。
 *
 * @see {@link note/create} ノート作成
 * @internal
 */
import type { Antenna } from "@/models/entities/antenna.js";
import type { Note } from "@/models/entities/note.js";
import { AntennaNotes, Mutings, Notes, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { hasMuteScope, MUTE_SCOPE_BITS } from "@/misc/mute-scope.js";
import { publishAntennaStream, publishMainStream } from "@/services/stream.js";
import { createNotification } from "@/services/create-notification.js";
import { webhookDeliver } from "@/queue/index.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import type { User } from "@/models/entities/user.js";
import { In } from "typeorm";
import Logger from "@/services/logger.js";

const addNoteToAntennaLogger = new Logger("add-note-to-antenna");

/**
 * アンテナにノートを追加する。
 * reply / renote / user を渡すと内部で再取得せずに再利用する（呼び出し元で既に取得済みのとき用）。
 *
 * @param antenna - アンテナ
 * @param note - 追加するノート
 * @param noteUser - ノート投稿者（id 必須）
 * @param options - 省略時は内部で reply / renote / user を取得。渡すとスキップして再利用
 * @internal
 */
export async function addNoteToAntenna(
	antenna: Antenna,
	note: Note,
	noteUser: { id: User["id"] },
	options?: {
		reply?: Note | null;
		renote?: Note | null;
		user?: User | null;
	},
) {
	// 通知しない設定になっているか、自分自身の投稿なら既読にする
	const read = !antenna.notify || antenna.userId === noteUser.id;

	const relatedUserIds = [
		note.userId,
		note.replyUserId,
		note.renoteUserId,
	].filter((id): id is string => id != null);
	const mutedUsers =
		relatedUserIds.length > 0
			? await Mutings.find({
					where: {
						muterId: antenna.userId,
						muteeId: In(relatedUserIds),
					},
					select: ["muteeId", "scope"],
			  })
			: [];
	const allMutedUserIds = new Set(
		mutedUsers
			.filter(
				(muting) => (muting.scope & MUTE_SCOPE_BITS.all) !== 0,
			)
			.map((muting) => muting.muteeId),
	);
	if (relatedUserIds.some((id) => allMutedUserIds.has(id))) {
		return;
	}
	const authorMuting = mutedUsers.find(
		(muting) => muting.muteeId === note.userId,
	);
	const muteType = note.renoteId != null && note.text == null ? "renote" : "note";
	if (
		authorMuting != null &&
		hasMuteScope(authorMuting.scope, muteType)
	) {
		return;
	}

	// NOTE: 3秒後の setTimeout 内で当該 noteId の read 状態を参照するため、
	// 競合を避けるため必ず await して insert を確定させる。
	await AntennaNotes.insert({
		id: genId(),
		antennaId: antenna.id,
		noteId: note.id,
		read: read,
	});

	publishAntennaStream(antenna.id, "note", note);

	if (!read) {
		const hydratedNote = await (async () => {
			const expanded: Note = { ...note };

			if (options?.reply !== undefined) {
				expanded.reply = options.reply ?? null;
			} else if (note.replyId) {
				expanded.reply = await Notes.findOneBy({ id: note.replyId });
			}
			if (options?.renote !== undefined) {
				expanded.renote = options.renote ?? null;
			} else if (note.renoteId) {
				expanded.renote = await Notes.findOneBy({ id: note.renoteId });
			}
			if (options?.user !== undefined) {
				expanded.user = options.user ?? null;
			} else if (noteUser.id != null) {
				expanded.user = await Users.findOneBy({ id: noteUser.id });
			}

			return expanded;
		})();

		// 3秒経っても既読にならなかったら通知
		setTimeout(async () => {
			try {
				// FIXED: 以前は同 antenna に未読が一件でもあれば通知発火していたが、
				// それでは「今追加したノート」が既読化されていても他の未読があれば push されるし、
				// 逆に過去未読がない状態だと「今追加したノート」の通知発火可否が他の状況に左右される。
				// 今回追加した AntennaNote 自身の read 状態だけを確認する。
				const unread = await AntennaNotes.findOneBy({
					antennaId: antenna.id,
					noteId: note.id,
					read: false,
				});
				if (!unread) return;

				publishMainStream(antenna.userId, "unreadAntenna", antenna);

				const __note =
					note.renoteId && !note.text ? hydratedNote.renote : note;
				if (__note == null || __note.id == null) {
					addNoteToAntennaLogger.warn(
						"skip unreadAntenna notification: note is missing",
						{
							antennaId: antenna.id,
							noteId: note.id,
						},
					);
					return;
				}

				await createNotification(
					antenna.userId,
					"unreadAntenna",
					{
						notifierId: noteUser.id,
						note: __note,
						noteId: __note.id,
						reaction: antenna.name,
					},
					{ notifier: hydratedNote.user ?? undefined },
				);

				const webhooks = await getActiveWebhooks().then((webhooks) =>
					webhooks.filter(
						(x) =>
							x.userId === antenna.userId &&
							x.on.includes("antenna") &&
							!x.on.includes(`exclude-${x.id}`),
					),
				);

				if (webhooks.length > 0) {
					const antennaUser = await Users.findOneByOrFail({
						id: antenna.userId,
					});
					const packedNote = await Notes.pack(__note, antennaUser);
					// NOTE: user id で pack することで、常に DB から取得した完全な packed を渡す。
					// エンティティを渡すと setTimeout や取得元によっては name/username が欠けた薄いオブジェクトになる場合がある。
					const packedNoteUser = await Users.pack(noteUser.id, antennaUser, {
						detail: false,
						relation: false,
					});
					const webhookPromises = webhooks.map((webhook) =>
						webhookDeliver(webhook, "antenna", {
							note: packedNote,
							antenna: {
								id: antenna.id,
								name: antenna.name,
								noteUser: packedNoteUser,
							},
						}),
					);
					await Promise.all(webhookPromises);
				}
			} catch (err) {
				addNoteToAntennaLogger.error("delayed antenna notification failed", {
					error: err,
				});
			}
		}, 3000);
	}
}
