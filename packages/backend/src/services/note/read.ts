import { publishMainStream } from "@/services/stream.js";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import {
	NoteUnreads,
	AntennaNotes,
	Users,
	Followings,
	ChannelFollowings,
} from "@/models/index.js";
import { In } from "typeorm";
import type { Channel } from "@/models/entities/channel.js";
import { checkHitAntenna } from "@/misc/check-hit-antenna.js";
import { getAntennas } from "@/misc/antenna-cache.js";
import { readNotificationByQuery } from "@/server/api/common/read-notification.js";
import type { Packed } from "@/misc/schema.js";

type NoteUnreadCounts = {
	mentions: number;
	specified: number;
	channel: number;
};

export function getNoteUnreadClearEvents(counts: NoteUnreadCounts) {
	const events: Array<
		"readAllUnreadMentions" | "readAllUnreadSpecifiedNotes" | "readAllChannels"
	> = [];

	if (counts.mentions === 0) {
		events.push("readAllUnreadMentions");
	}

	if (counts.specified === 0) {
		events.push("readAllUnreadSpecifiedNotes");
	}

	if (counts.channel === 0) {
		events.push("readAllChannels");
	}

	return events;
}

export function getReadAntennaIds(
	countsByAntennaId: Map<string, number>,
	antennaIds: string[],
) {
	return antennaIds.filter((antennaId) =>
		(countsByAntennaId.get(antennaId) ?? 0) === 0,
	);
}

async function countUnreadNotes(userId: User["id"]): Promise<NoteUnreadCounts> {
	const rawCounts = await NoteUnreads.createQueryBuilder("noteUnread")
		.select(
			"SUM(CASE WHEN noteUnread.isMentioned = true THEN 1 ELSE 0 END)",
			"mentions",
		)
		.addSelect(
			"SUM(CASE WHEN noteUnread.isSpecified = true THEN 1 ELSE 0 END)",
			"specified",
		)
		.addSelect(
			"SUM(CASE WHEN noteUnread.noteChannelId IS NOT NULL THEN 1 ELSE 0 END)",
			"channel",
		)
		.where("noteUnread.userId = :userId", { userId })
		.getRawOne<{ mentions: string | null; specified: string | null; channel: string | null }>();

	return {
		mentions: Number(rawCounts?.mentions ?? 0),
		specified: Number(rawCounts?.specified ?? 0),
		channel: Number(rawCounts?.channel ?? 0),
	};
}

async function countUnreadAntennaNotesByAntennaId(antennaIds: string[]) {
	const countsByAntennaId = new Map<string, number>();

	if (antennaIds.length === 0) {
		return countsByAntennaId;
	}

	const rawCounts = await AntennaNotes.createQueryBuilder("antennaNote")
		.select("antennaNote.antennaId", "antennaId")
		.addSelect("COUNT(*)", "count")
		.where("antennaNote.antennaId IN (:...antennaIds)", { antennaIds })
		.andWhere("antennaNote.read = :read", { read: false })
		.groupBy("antennaNote.antennaId")
		.getRawMany<{ antennaId: string; count: string }>();

	for (const rawCount of rawCounts) {
		countsByAntennaId.set(rawCount.antennaId, Number(rawCount.count));
	}

	return countsByAntennaId;
}

/**
 * Mark notes as read
 */
export default async function (
	userId: User["id"],
	notes: (Note | Packed<"Note">)[],
	info?: {
		following: Set<User["id"]>;
		followingChannels: Set<Channel["id"]>;
	},
) {
	const following = info?.following
		? info.following
		: new Set<string>(
				(
					await Followings.find({
						where: {
							followerId: userId,
						},
						select: ["followeeId"],
					})
				).map((x) => x.followeeId),
		  );
	const followingChannels = info?.followingChannels
		? info.followingChannels
		: new Set<string>(
				(
					await ChannelFollowings.find({
						where: {
							followerId: userId,
						},
						select: ["followeeId"],
					})
				).map((x) => x.followeeId),
		  );

	const myAntennas = (await getAntennas()).filter((a) => a.userId === userId);
	const readMentions: (Note | Packed<"Note">)[] = [];
	const readSpecifiedNotes: (Note | Packed<"Note">)[] = [];
	const readChannelNotes: (Note | Packed<"Note">)[] = [];
	const readAntennaNotes: (Note | Packed<"Note">)[] = [];
	const readAntennaNoteIds = new Set<Note["id"]>();
	const followingArray = Array.from(following);

	for (const note of notes) {
		if (note.mentions?.includes(userId)) {
			readMentions.push(note);
		} else if (note.visibleUserIds?.includes(userId)) {
			readSpecifiedNotes.push(note);
		}

		if (note.channelId && followingChannels.has(note.channelId)) {
			readChannelNotes.push(note);
		}

		if (note.user != null && myAntennas.length > 0) {
			// たぶんnullになることは無いはずだけど一応
			const results = await Promise.all(
				myAntennas.map((antenna) =>
					checkHitAntenna(
						antenna,
						note,
						note.user!,
						undefined,
						followingArray,
					),
				),
			);

			if (results.some(Boolean) && !readAntennaNoteIds.has(note.id)) {
				readAntennaNoteIds.add(note.id);
				readAntennaNotes.push(note);
			}
		}
	}

	if (
		readMentions.length > 0 ||
		readSpecifiedNotes.length > 0 ||
		readChannelNotes.length > 0
	) {
		// Remove the record
		await NoteUnreads.delete({
			userId: userId,
			noteId: In([
				...readMentions.map((n) => n.id),
				...readSpecifiedNotes.map((n) => n.id),
				...readChannelNotes.map((n) => n.id),
			]),
		});

		const unreadCounts = await countUnreadNotes(userId);

		for (const event of getNoteUnreadClearEvents(unreadCounts)) {
			publishMainStream(userId, event);
		}

		readNotificationByQuery(userId, {
			noteId: In([
				...readMentions.map((n) => n.id),
				...readSpecifiedNotes.map((n) => n.id),
			]),
		});
	}

	if (readAntennaNotes.length > 0) {
		const myAntennaIds = myAntennas.map((a) => a.id);

		await AntennaNotes.update(
			{
				antennaId: In(myAntennaIds),
				noteId: In(readAntennaNotes.map((n) => n.id)),
			},
			{
				read: true,
			},
		);

		const unreadAntennaCountsById = await countUnreadAntennaNotesByAntennaId(
			myAntennaIds,
		);

		for (const antennaId of getReadAntennaIds(unreadAntennaCountsById, myAntennaIds)) {
			const antenna = myAntennas.find((a) => a.id === antennaId);
			if (antenna != null) {
				publishMainStream(userId, "readAntenna", antenna);
			}
		}

		Users.getHasUnreadAntenna(userId).then((unread) => {
			if (!unread) {
				publishMainStream(userId, "readAllAntennas");
			}
		});
	}
}
