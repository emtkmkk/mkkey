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
import { Not, IsNull, In } from "typeorm";
import type { Channel } from "@/models/entities/channel.js";
import { checkHitAntenna } from "@/misc/check-hit-antenna.js";
import { getAntennas } from "@/misc/antenna-cache.js";
import { readNotificationByQuery } from "@/server/api/common/read-notification.js";
import type { Packed } from "@/misc/schema.js";

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

		// TODO: ↓まとめてクエリしたい

		NoteUnreads.countBy({
			userId: userId,
			isMentioned: true,
		}).then((mentionsCount) => {
			if (mentionsCount === 0) {
				// 全て既読になったイベントを発行
				publishMainStream(userId, "readAllUnreadMentions");
			}
		});

		NoteUnreads.countBy({
			userId: userId,
			isSpecified: true,
		}).then((specifiedCount) => {
			if (specifiedCount === 0) {
				// 全て既読になったイベントを発行
				publishMainStream(userId, "readAllUnreadSpecifiedNotes");
			}
		});

		NoteUnreads.countBy({
			userId: userId,
			noteChannelId: Not(IsNull()),
		}).then((channelNoteCount) => {
			if (channelNoteCount === 0) {
				// 全て既読になったイベントを発行
				publishMainStream(userId, "readAllChannels");
			}
		});

		readNotificationByQuery(userId, {
			noteId: In([
				...readMentions.map((n) => n.id),
				...readSpecifiedNotes.map((n) => n.id),
			]),
		});
	}

	if (readAntennaNotes.length > 0) {
		await AntennaNotes.update(
			{
				antennaId: In(myAntennas.map((a) => a.id)),
				noteId: In(readAntennaNotes.map((n) => n.id)),
			},
			{
				read: true,
			},
		);

                // TODO: まとめてクエリしたい
                const antennaCounts = await Promise.all(
                        myAntennas.map(async (antenna) => ({
                                antenna,
                                count: await AntennaNotes.countBy({
                                        antennaId: antenna.id,
                                        read: false,
                                }),
                        })),
                );

                for (const { antenna, count } of antennaCounts) {
                        if (count === 0) {
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
