import type { Antenna } from "@/models/entities/antenna.js";
import type { Note } from "@/models/entities/note.js";
import { AntennaNotes, Mutings, Notes } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { isUserRelated } from "@/misc/is-user-related.js";
import { publishAntennaStream, publishMainStream } from "@/services/stream.js";
import { createNotification } from "@/services/create-notification.js";
import { webhookDeliver } from "@/queue/index.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import type { User } from "@/models/entities/user.js";

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
		const mutings = await Mutings.find({
			where: {
				muterId: antenna.userId,
			},
			select: ["muteeId"],
		});

		// Copy
		const _note: Note = {
			...note,
		};

		if (note.replyId != null) {
			_note.reply = await Notes.findOneByOrFail({ id: note.replyId });
		}
		if (note.renoteId != null) {
			_note.renote = await Notes.findOneByOrFail({ id: note.renoteId });
		}

		if (isUserRelated(_note, new Set<string>(mutings.map((x) => x.muteeId)))) {
			return;
		}

		// 3秒経っても既読にならなかったら通知
		setTimeout(async () => {
			const unread = await AntennaNotes.findOneBy({
				antennaId: antenna.id,
				read: false,
			});
			if (unread) {
				publishMainStream(antenna.userId, "unreadAntenna", antenna);
				
				const __note = note.renoteId && !note.text ? _note.renote : note;
				
				// 通知を作成
				createNotification(antenna.userId, "unreadAntenna", {
					notifierId: noteUser.id,
					note: __note,
					noteId: __note.id,
					reaction: antenna.name,
				});
				
				const webhooks = await getActiveWebhooks().then((webhooks) =>
				webhooks.filter((x) => x.userId === note.userId && x.on.includes("antenna")),
				);

				for (const webhook of webhooks) {
					webhookDeliver(webhook, antenna.name + "アンテナ新着 " + (note.user.name || note.user.username) + " から", {
						note: await Notes.pack(note, note.user),
					});
				}
			}
			
		}, 3000);
	}
}
