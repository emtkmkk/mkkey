import type { Antenna } from "@/models/entities/antenna.js";
import type { Note } from "@/models/entities/note.js";
import { AntennaNotes, Mutings, Notes, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import { publishAntennaStream, publishMainStream } from "@/services/stream.js";
import { createNotification } from "@/services/create-notification.js";
import { webhookDeliver } from "@/queue/index.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import type { User } from "@/models/entities/user.js";
import { In } from "typeorm";

export async function addNoteToAntenna(
	antenna: Antenna,
	note: Note,
	noteUser: { id: User["id"] },
) {
	// 通知しない設定になっているか、自分自身の投稿なら既読にする
	const read = !antenna.notify || antenna.userId === noteUser.id;

	AntennaNotes.insert({
		id: genId(),
		antennaId: antenna.id,
		noteId: note.id,
		read: read,
	});

	publishAntennaStream(antenna.id, "note", note);

	if (!read) {
		const hydratedNote = await (async () => {
			const expanded: Note = { ...note };

			const [reply, renote] = await Promise.all([
				note.replyId ? Notes.findOneBy({ id: note.replyId }) : null,
				note.renoteId ? Notes.findOneBy({ id: note.renoteId }) : null,
			]);

			expanded.reply = reply;
			expanded.renote = renote;

			if (noteUser.id != null) {
				expanded.user = await Users.findOneBy({ id: noteUser.id });
			}

			return expanded;
		})();

		const relatedUserIds = Array.from(collectRelatedUserIds(hydratedNote));

		if (relatedUserIds.length > 0) {
			const mutedUsers = await Mutings.find({
				where: {
					muterId: antenna.userId,
					muteeId: In(relatedUserIds),
				},
				select: ["muteeId"],
			});

			if (mutedUsers.length > 0) {
				const mutedUserSet = new Set<string>(mutedUsers.map((x) => x.muteeId));

				if (isUserRelated(hydratedNote, mutedUserSet)) {
					return;
				}
			}
		}

		// 3秒経っても既読にならなかったら通知
		setTimeout(async () => {
			const unread = await AntennaNotes.findOneBy({
				antennaId: antenna.id,
				read: false,
			});
			if (unread) {
				publishMainStream(antenna.userId, "unreadAntenna", antenna);

				const __note = note.renoteId && !note.text ? hydratedNote.renote : note;

				// 通知を作成
				createNotification(antenna.userId, "unreadAntenna", {
					notifierId: noteUser.id,
					note: __note,
					noteId: __note.id,
					reaction: antenna.name,
				});

				const webhooks = await getActiveWebhooks().then((webhooks) =>
					webhooks.filter(
						(x) =>
							x.userId === antenna.userId &&
							x.on.includes("antenna") &&
							!x.on.includes(`exclude-${x.id}`),
					),
				);

				const webhookPromises = webhooks.map(async (webhook) => {
					const antennaUser = await Users.findOneByOrFail({
						id: antenna.userId,
					});
					await webhookDeliver(webhook, "antenna", {
						note: await Notes.pack(__note, antennaUser),
						antenna: {
							id: antenna.id,
							name: antenna.name,
							noteUser: hydratedNote.user,
						},
					});
				});

				await Promise.all(webhookPromises);
			}
		}, 3000);
	}
}

function collectRelatedUserIds(note: any, acc: Set<string> = new Set()): Set<string> {
	if (note == null) {
		return acc;
	}

	if (typeof note.userId === "string") {
		acc.add(note.userId);
	}

	if (Array.isArray(note.mentions)) {
		for (const userId of note.mentions) {
			if (typeof userId === "string") {
				acc.add(userId);
			}
		}
	}

	if (note.reply) {
		collectRelatedUserIds(note.reply, acc);
	}

	if (note.renote) {
		collectRelatedUserIds(note.renote, acc);
	}

	return acc;
}
