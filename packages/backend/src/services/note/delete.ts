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
import { Notes, Users, Instances } from "@/models/index.js";
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

/**
 * 投稿を削除します。
 * @param user 投稿者
 * @param note 投稿
 */
export default async function (
	user: { id: User["id"]; uri: User["uri"]; host: User["host"] },
	note: Note,
	quiet = false,
) {

	if (note.deletedAt) {
		return;
	}

	const isRenote = note.renoteId &&
				note.text == null &&
				!note.hasPoll &&
				(note.fileIds == null || note.fileIds.length === 0);

	const deletedAt = new Date();

	console.log(`deleteNote : ${note.id}`)

	// この投稿を除く指定したユーザーによる指定したノートのリノートが存在しないとき
	if (
		note.renoteId &&
		(await countSameRenotes(user.id, note.renoteId, note.id)) === 0
	) {
		Notes.decrement({ id: note.renoteId }, "renoteCount", 1);
		Notes.decrement({ id: note.renoteId }, "score", (user.host ? '3' : '9'));
	}

	if (note.replyId) {
		await Notes.decrement({ id: note.replyId }, "repliesCount", 1);
	}

	if (!quiet) {
		publishNoteStream(note.id, "deleted", {
			deletedAt: deletedAt,
		});

		//#region ローカルの投稿なら削除アクティビティを配送
		if (Users.isLocalUser(user) && !(note.localOnly && note.channelId)) {
			let renote: Note | null = null;

			// if deletd note is renote
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
					: renderDelete(
						renderTombstone(`${config.url}/notes/${note.id}`),
						user,
					),
			);

			deliverToConcerned(user, note, content);
		}

		if (isRenote || deletedAt.valueOf() < (note.createdAt.valueOf() + (1000 * 60 * 30))) {

			// also deliever delete activity to cascaded notes
			const cascadingNotes = (await findCascadingNotes(note)).filter(
				(note) => !note.localOnly,
			); // filter out local-only notes
			for (const cascadingNote of cascadingNotes) {
				console.log(`cascadeDeleteNote(${cascadingNotes.length}) : ${cascadingNote.id}`)
				if (!cascadingNote.user) continue;
				if (!Users.isLocalUser(cascadingNote.user)) continue;
				const content = renderActivity(
					renderDelete(
						renderTombstone(`${config.url}/notes/${cascadingNote.id}`),
						cascadingNote.user,
					),
				);
				deliverToConcerned(cascadingNote.user, cascadingNote, content);
				if (cascadingNote.visibility !== "specified") decNotesCountOfUser(user);
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

			await Notes.update({
				id: note.id,
				userId: user.id,
			},{
				text: null,
				cw: null,
				fileIds: {},
				attachedFileTypes: {},
				mentions: {},
				mentionedRemoteUsers: [],
				emojis: [],
				tags: [],
				hasPoll: false,
				deletedAt: deletedAt,
			});

		}

	}

	if (isRenote || deletedAt.valueOf() < (note.createdAt.valueOf() + (1000 * 60 * 30))) {
		// ノート数を減らす
		if (note.visibility !== "specified") decNotesCountOfUser(user);

		await Notes.delete({
			id: note.id,
			userId: user.id,
		});
	}

}

async function findCascadingNotes(note: Note) {
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

	return cascadingNotes.filter((note) => note.userHost === null); // filter out non-local users
}

async function getMentionedRemoteUsers(note: Note) {
	const where = [] as any[];

	// mention / reply / dm
	const uris = (
		JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers
	).map((x) => x.uri);
	if (uris.length > 0) {
		where.push({ uri: In(uris) });
	}

	// renote / quote
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
