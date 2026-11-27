/**
 * @packageDocumentation
 *
 * ノート（投稿）の削除処理を行うサービス。
 *
 * @remarks
 * - **役割**: API や AP の Delete でノート削除時に、DB 削除・配信・ストリーム通知を行う。
 *
 * @see {@link server/api/endpoints/notes/delete} ノート削除 API
 * @internal
 */

import { Brackets, In, IsNull, MoreThan } from "typeorm";
import { publishNoteStream } from "@/services/stream.js";
import renderDelete from "@/remote/activitypub/renderer/delete.js";
import renderAnnounce from "@/remote/activitypub/renderer/announce.js";
import renderUndo from "@/remote/activitypub/renderer/undo.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import renderTombstone from "@/remote/activitypub/renderer/tombstone.js";
import config from "@/config/index.js";
import type { User, ILocalUser, IRemoteUser } from "@/models/entities/user.js";
import type { Note, IMentionedRemoteUsers } from "@/models/entities/note.js";
import { Notes, Users, Instances, DriveFiles } from "@/models/index.js";
import {
	notesChart,
	perUserNotesChart,
	instanceChart,
} from "@/services/chart/index.js";
import { countSameRenotes } from "@/misc/count-same-renotes.js";
import { registerOrFetchInstanceDoc } from "../register-or-fetch-instance-doc.js";
import { deliverToRelays } from "../relay.js";
import { noteLogger } from "./logger.js";
import { getLocalRelayInboxes } from "@/services/local-relay.js";
import DeliverManager, { deliverToInboxes } from "@/remote/activitypub/deliver-manager.js";

/**
 * 投稿を削除します。
 * @param user 投稿者
 * @param note 投稿
 */
export default async function (
	user: { id: User["id"]; uri: User["uri"]; host: User["host"] },
	note: Note,
	quiet = false,
	isAdmin = false,
) {
	if (note.deletedAt) {
		if (
			Users.isLocalUser(user) &&
			!(note.localOnly && note.channelId) &&
			!(
				note.lastSendActivityAt &&
				Date.now() < note.lastSendActivityAt.valueOf() + 1000 * 60 * 30
			)
		) {
			await Notes.update(
				{
					id: note.id,
					userId: user.id,
				},
				{
					lastSendActivityAt: new Date(),
				},
			);
			await deleteActivity(user, note);
		}
		return;
	}

	const attachedFileIds = Array.isArray(note.fileIds) ? [...note.fileIds] : [];

	const isRenote =
		note.renoteId &&
		note.cw == null &&
		note.text == null &&
		!note.hasPoll &&
		(note.fileIds == null || note.fileIds.length === 0);

	const deletedAt = new Date();

	noteLogger.debug(`deleteNote : ${note.id}`);

	// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
	if (
		note.renoteId &&
		(await countSameRenotes(user.id, note.renoteId, note.id)) === 0
	) {
		Notes.decrement({ id: note.renoteId }, "renoteCount", 1);
		Notes.decrement({ id: note.renoteId }, "score", user.host ? "3" : "9");
	}

	if (note.replyId) {
		await Notes.decrement({ id: note.replyId }, "repliesCount", 1);
	}

	const isPhysical =
		!isAdmin &&
		!note.score &&
		!note.repliesCount &&
		(isRenote ||
			deletedAt.valueOf() <
				note.createdAt.valueOf() + (1000 * 60 * 3));

	if (!quiet) {
		publishNoteStream(note.id, "deleted", {
			deletedAt: deletedAt,
			physical: isPhysical,
		});

		await deleteActivity(user, note);

		if (isPhysical) {
			// カスケードされたノートにも delete アクティビティを配信
			const cascadingNotes = (await findCascadingNotes(note)).filter(
				(note) => !(note.localOnly && note.channelId),
			); // リモートフォロワー／ローカルリレーへ送った投稿も削除する。
			for (const cascadingNote of cascadingNotes) {
				noteLogger.debug(
					`cascadeDeleteNote(${cascadingNotes.length}) : ${cascadingNote.id}`,
				);
				if (!cascadingNote.user) continue;
				if (!Users.isLocalUser(cascadingNote.user)) continue;
				const content = renderActivity(
					renderDelete(
						renderTombstone(`${config.url}/notes/${cascadingNote.id}`),
						cascadingNote.user,
					),
				);
				await deliverToConcerned(cascadingNote.user, cascadingNote, content);
				// カスケード対象ノートの投稿者本人のノート数を減算する
				if (cascadingNote.visibility !== "specified") {
					decNotesCountOfUser(cascadingNote.user);
				}
			}
			//#endregion

			// 統計を更新
			notesChart.update(note, false);
			perUserNotesChart.update(user, note, false);

			if (Users.isRemoteUser(user)) {
				registerOrFetchInstanceDoc(user.host).then((i) => {
					Instances.decrement({ id: i.id }, "notesCount", 1);
					instanceChart.updateNote(i.host, note, false);
				});
			}
		} else {
			const textCaption = tombstoneCaption(note, isAdmin);

			await Notes.update(
				{
					id: note.id,
					userId: user.id,
				},
				{
					text: textCaption || null,
					cw: null,
					// NOTE: 配列カラムは空配列で空にする。以前は `{}` を渡していたが、pg ドライバはどちらも '{}' に
					// 直列化するため SQL 上は同じ。mentionedRemoteUsers は JSON 文字列のカラムなので "[]" を入れる
					fileIds: [],
					attachedFileTypes: [],
					mentions: [],
					mentionedRemoteUsers: "[]",
					emojis: [],
					tags: [],
					hasPoll: false,
					deletedAt: deletedAt,
				},
			);
		}
	}

	if (attachedFileIds.length > 0) {
		try {
			await DriveFiles.adjustUsageCount(attachedFileIds, -1);
		} catch (err) {
			noteLogger.warn("Failed to decrement drive file usage count", { e: err });
		}
	}

	if (isPhysical) {
		// ノート数を減らす
		if (note.visibility !== "specified") decNotesCountOfUser(user);

		await Notes.delete({
			id: note.id,
			userId: user.id,
		});
	}
}

async function deleteActivity(
	user: { id: User["id"]; uri: User["uri"]; host: User["host"] },
	note: Note,
) {
	//#region ローカルの投稿なら削除アクティビティを配送
	if (Users.isLocalUser(user) && !(note.localOnly && note.channelId)) {
		let renote: Note | null = null;

		// 削除対象ノートがリノートの場合
		if (
			note.renoteId &&
			note.text == null &&
			!note.hasPoll &&
			(note.fileIds == null || note.fileIds.length === 0)
		) {
			renote = await Notes.findOneBy({
				id: note.renoteId,
			});
		}

		const content = renderActivity(
			renote
				? renderUndo(
						renderAnnounce(
							renote.uri || `${config.url}/notes/${renote.id}`,
							note,
						),
						user,
				  )
				: renderDelete(renderTombstone(`${config.url}/notes/${note.id}`), user),
		);

		await deliverToConcerned(user, note, content);
	}
}

/**
 * カスケード削除対象のノートを取得する（replyId / renoteId+text の再帰、ローカルユーザーのみ）。
 * @internal
 */
async function findCascadingNotes(note: Note): Promise<Note[]> {
	const cascadingNotes: Note[] = [];

	const recursive = async (noteId: string) => {
		const query = Notes.createQueryBuilder("note")
			.where("note.replyId = :noteId", { noteId })
			.orWhere(
				new Brackets((q) => {
					q.where("note.renoteId = :noteId", { noteId }).andWhere(
						"note.text IS NOT NULL",
					);
				}),
			)
			.leftJoinAndSelect("note.user", "user");
		const replies = await query.getMany();
		for (const reply of replies) {
			cascadingNotes.push(reply);
			await recursive(reply.id);
		}
	};
	await recursive(note.id);

	return cascadingNotes.filter((n) => n.userHost === null);
}

async function getMentionedRemoteUsers(note: Note) {
	const where = [] as any[];

	// メンション / 返信 / DM
	const uris = (
		JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers
	).map((x) => x.uri);
	if (uris.length > 0) {
		where.push({ uri: In(uris) });
	}

	// リノート / 引用
	if (note.renoteUserId) {
		where.push({
			id: note.renoteUserId,
		});
	}

	if (where.length === 0) return [];

	return (await Users.find({
		where,
	})) as IRemoteUser[];
}

async function deliverToConcerned(
	user: { id: ILocalUser["id"]; host: null },
	note: Note,
	content: any,
) {
	const dm = new DeliverManager(user, content);
	dm.addFollowersRecipe();
	const remoteUsers = await getMentionedRemoteUsers(note);
	for (const remoteUser of remoteUsers) {
		dm.addDirectRecipe(remoteUser);
	}
	const inboxes = await dm.collectInboxes();
	for (const [inbox, shared] of await getLocalRelayInboxes(note)) inboxes.set(inbox, shared);
	await deliverToInboxes(user, content, inboxes);
	await deliverToRelays(user, content, new Set(inboxes.keys()));
}

function decNotesCountOfUser(user: { id: User["id"]; host: User["host"] }) {
	if (user.host) return;
	Users.createQueryBuilder()
		.update()
		.set({
			updatedAt: new Date(),
			notesCount: () => '"notesCount" - 1',
		})
		.where("id = :id", { id: user.id })
		.execute();
}

/**
 * 抜け殻（中身を消した投稿）の本文に入れる説明文を作る。
 *
 * @param note - 消す前の投稿
 * @param isAdmin - 管理者が消したなら true（先頭に「*」を付ける）
 * @returns 「CW 10, 📝 120, 📊, 📎 2, QT」のような、元に何があったかを表す文字。何も無ければ null
 *
 * @remarks
 * 1 件ずつの削除と、アカウント削除のまとめての削除（{@link deleteNotesOfDeletedAccount}）で同じものを使う。
 *
 * @internal
 */
function tombstoneCaption(note: Note, isAdmin: boolean): string | null {
	const caption = [
		note.cw?.length ? `CW ${note.cw.length}` : "",
		note.text?.length ? `📝 ${note.text.length}` : "",
		note.hasPoll ? "📊" : "",
		note.fileIds?.length ? `📎 ${note.fileIds.length}` : "",
		note.renoteId ? "QT" : "",
	]
		.filter(Boolean)
		.join(", ");

	return [isAdmin ? "*" : "", caption].filter(Boolean).join(" ") || null;
}

/**
 * 削除されたアカウントの投稿を、まとめて消す（アカウント削除ジョブ用）。
 *
 * @param user - 投稿者（削除されたアカウント）
 * @param notes - 消す投稿（同じ投稿者のもの。100 件ほどを想定）
 * @returns 消し終わった時点で解決する Promise
 *
 * @remarks
 * - 1 件ずつの削除（このファイルの既定の関数）と同じ結果になるようにしつつ、DB の操作を束ごとにまとめる。
 *   以前は 1 件ずつ処理していて、1 万件を超える投稿のあるアカウントで 30 分近くかかっていた（2026-11 本番）。
 * - 抜け殻を残すかどうかの決まりは 1 件ずつの削除と同じ。リアクションも返信も無く、
 *   純粋なリノートか作って 3 分以内なら行ごと消し、それ以外は中身を消した抜け殻として残す。
 *   抜け殻は、相手のサーバーが投稿の URL を取りに来たときに「作者は削除済み」と分かり、
 *   ユーザーの Delete を送り直すきっかけになる（server/activitypub.ts の resendDeleteAccount）。
 * - 投稿ごとの Delete は配送しない。ユーザーの Delete を、知っているすべてのサーバーと外部のリレーに
 *   送ってあるため（services/suspend-user.ts の doPostSuspend）。
 * - リノート数は「リノートした人の数」なので、このユーザーがリノート・引用していた投稿ごとに 1 だけ減らす。
 *   同じ投稿へのリノートが後の束にも残っていれば、最後の束で減らす。
 *   CHANGED: 1 件ずつの削除は抜け殻の行も数えるため、引用とリノートの両方をしていると減らないことがあった。
 * - NB: 行ごと消す投稿は、リアクションも返信も無いものに限るので、それを参照する投稿は無い。
 *   そのため、1 件ずつの削除がしている「巻き込まれて消える投稿」の後始末は要らない。
 *
 * @internal
 */
export async function deleteNotesOfDeletedAccount(
	user: { id: User["id"]; host: User["host"] },
	notes: Note[],
): Promise<void> {
	const targets = notes.filter(
		(note) => note.userId === user.id && note.deletedAt == null,
	);
	if (targets.length === 0) return;

	const deletedAt = new Date();
	const isPhysical = (note: Note): boolean =>
		!note.score &&
		!note.repliesCount &&
		(isPureRenote(note) ||
			deletedAt.valueOf() < note.createdAt.valueOf() + 1000 * 60 * 3);
	const physical = targets.filter(isPhysical);
	const tombstones = targets.filter((note) => !isPhysical(note));

	// #region 抜け殻に書き換える・行ごと消す
	if (tombstones.length > 0) {
		// 説明文は投稿ごとに違うので、(id, 説明文) の組を VALUES で渡して 1 本の UPDATE にする
		const params: unknown[] = [deletedAt, user.id];
		const values = tombstones.map((note) => {
			params.push(note.id, tombstoneCaption(note, false));
			return `($${params.length - 1}::varchar, $${params.length}::text)`;
		});
		await Notes.query(
			`UPDATE "note" SET
				"text" = v."caption", "cw" = NULL, "fileIds" = '{}', "attachedFileTypes" = '{}',
				"mentions" = '{}', "mentionedRemoteUsers" = '[]', "emojis" = '{}', "tags" = '{}',
				"hasPoll" = false, "deletedAt" = $1
			FROM (VALUES ${values.join(", ")}) AS v("id", "caption")
			WHERE "note"."id" = v."id" AND "note"."userId" = $2`,
			params,
		);
	}

	if (physical.length > 0) {
		await Notes.delete({ id: In(physical.map((note) => note.id)), userId: user.id });

		for (const note of physical) {
			notesChart.update(note, false);
			perUserNotesChart.update(user, note, false);
		}

		if (Users.isRemoteUser(user)) {
			registerOrFetchInstanceDoc(user.host).then((i) => {
				Instances.decrement({ id: i.id }, "notesCount", physical.length);
				for (const note of physical) instanceChart.updateNote(i.host, note, false);
			});
		} else {
			// ノート数は、行ごと消した分だけ減らす（1 件ずつの削除と同じ。ダイレクトは数えていない）
			const count = physical.filter((note) => note.visibility !== "specified").length;
			if (count > 0) {
				await Users.createQueryBuilder()
					.update()
					.set({
						updatedAt: new Date(),
						notesCount: () => `"notesCount" - ${count}`,
					})
					.where("id = :id", { id: user.id })
					.execute();
			}
		}
	}
	// #endregion

	// #region 相手の投稿の数を直す
	// 返信先の返信数を、返信していた数だけ減らす
	const repliesByTarget = countBy(targets.map((note) => note.replyId));
	if (repliesByTarget.size > 0) {
		const params: unknown[] = [];
		const values = [...repliesByTarget].map(([id, n]) => {
			params.push(id, n);
			return `($${params.length - 1}::varchar, $${params.length}::int)`;
		});
		await Notes.query(
			`UPDATE "note" SET "repliesCount" = GREATEST("note"."repliesCount" - v."n", 0)
			FROM (VALUES ${values.join(", ")}) AS v("id", "n")
			WHERE "note"."id" = v."id"`,
			params,
		);
	}

	// リノート・引用していた投稿のリノート数を 1 減らす（後の束にまだ残っているものは、その束で減らす）
	const renoteIds = [
		...new Set(targets.map((note) => note.renoteId).filter((id): id is string => id != null)),
	];
	if (renoteIds.length > 0) {
		const lastId = targets.reduce((max, note) => (note.id > max ? note.id : max), targets[0].id);
		const stillLeft = await Notes.find({
			select: ["renoteId"],
			where: {
				userId: user.id,
				deletedAt: IsNull(),
				id: MoreThan(lastId),
				renoteId: In(renoteIds),
			},
		});
		const leftIds = new Set(stillLeft.map((note) => note.renoteId));
		const finished = renoteIds.filter((id) => !leftIds.has(id));
		if (finished.length > 0) {
			await Notes.createQueryBuilder()
				.update()
				.set({
					renoteCount: () => 'GREATEST("renoteCount" - 1, 0)',
					score: () => `GREATEST("score" - ${user.host ? 3 : 9}, 0)`,
				})
				.where("id IN (:...ids)", { ids: finished })
				.execute();
		}
	}

	// 添付ファイルの使用数を、添付していた回数だけ減らす
	const filesByCount = new Map<number, string[]>();
	for (const [fileId, n] of countBy(targets.flatMap((note) => note.fileIds ?? []))) {
		filesByCount.set(n, [...(filesByCount.get(n) ?? []), fileId]);
	}
	for (const [n, fileIds] of filesByCount) {
		try {
			await DriveFiles.adjustUsageCount(fileIds, -n);
		} catch (err) {
			noteLogger.warn("Failed to decrement drive file usage count", { e: err });
		}
	}
	// #endregion

	// 開いている画面に、消えたことを知らせる（1 件ずつの削除と同じ）
	for (const note of targets) {
		publishNoteStream(note.id, "deleted", {
			deletedAt: deletedAt,
			physical: isPhysical(note),
		});
	}
}

/**
 * 本文・CW・投票・添付が無い、純粋なリノートか。
 *
 * @param note - 投稿
 * @returns 純粋なリノートなら true
 * @internal
 */
function isPureRenote(note: Note): boolean {
	return (
		note.renoteId != null &&
		note.cw == null &&
		note.text == null &&
		!note.hasPoll &&
		(note.fileIds == null || note.fileIds.length === 0)
	);
}

/**
 * 値ごとの個数を数える（null / undefined は数えない）。
 *
 * @param values - 数える値
 * @returns 値 → 個数
 * @internal
 */
function countBy(values: (string | null | undefined)[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const value of values) {
		if (value == null) continue;
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return counts;
}
