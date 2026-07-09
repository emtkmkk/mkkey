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

import { Brackets, In } from "typeorm";
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
import {
	deliverToFollowers,
	deliverToUser,
} from "@/remote/activitypub/deliver-manager.js";
import { countSameRenotes } from "@/misc/count-same-renotes.js";
import { registerOrFetchInstanceDoc } from "../register-or-fetch-instance-doc.js";
import { deliverToRelays } from "../relay.js";
import { noteLogger } from "./logger.js";

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
				(note) => !note.localOnly,
			); // filter out local-only notes
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
				deliverToConcerned(cascadingNote.user, cascadingNote, content);
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
			let textCaption = [
				note.cw?.length ? `CW ${note.cw.length}` : "",
				note.text?.length ? `📝 ${note.text.length}` : "",
				note.hasPoll ? "📊" : "",
				note.fileIds?.length ? `📎 ${note.fileIds.length}` : "",
				note.renoteId ? "QT" : "",
			]
				.filter(Boolean)
				.join(", ");

			textCaption = [isAdmin ? "*" : "", textCaption].filter(Boolean).join(" ");

			await Notes.update(
				{
					id: note.id,
					userId: user.id,
				},
				{
					text: textCaption || null,
					cw: null,
					fileIds: {},
					attachedFileTypes: {},
					mentions: {},
					mentionedRemoteUsers: [],
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

		deliverToConcerned(user, note, content);
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
	deliverToFollowers(user, content);
	deliverToRelays(user, content);
	const remoteUsers = await getMentionedRemoteUsers(note);
	for (const remoteUser of remoteUsers) {
		deliverToUser(user, content, remoteUser);
	}
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
