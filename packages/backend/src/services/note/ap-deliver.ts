/**
 * ノート AP 配信ジョブ
 */
import DeliverManager, { deliverToInboxes } from "@/remote/activitypub/deliver-manager.js";
import renderNote from "@/remote/activitypub/renderer/note.js";
import renderCreate from "@/remote/activitypub/renderer/create.js";
import renderAnnounce from "@/remote/activitypub/renderer/announce.js";
import { renderLike } from "@/remote/activitypub/renderer/like.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import config from "@/config/index.js";
import { countSameRenotes } from "@/misc/count-same-renotes.js";
import { deliverToRelays } from "../relay.js";
import { decodeReaction, resolveApReaction } from "@/misc/reaction-lib.js";
import { buildReactionDeliverManager } from "@/services/note/reaction/deliver.js";
import { Emojis, NoteReactions, Notes, Users } from "@/models/index.js";
import { In, IsNull } from "typeorm";
import type { ILocalUser, User } from "@/models/entities/user.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import type { Note } from "@/models/entities/note.js";
import type { NoteApDeliverJobData } from "@/queue/types.js";
import { noteApDeliverLogger } from "@/services/note/logger.js";

export async function processNoteApDeliverJob(data: NoteApDeliverJobData) {
	const startedAt = Date.now();
	noteApDeliverLogger.debug(
		`[note-deliver-metric] queue_delay_ms=${startedAt - data.queuedAt} note=${data.noteId}`,
	);

	const note = await Notes.findOne({
		where: { id: data.noteId },
		relations: ["user", "reply", "renote"],
	});
	if (!note || !note.user || !Users.isLocalUser(note.user)) return;

	const noteActivity = await renderNoteOrRenoteActivityFromNote(note);
	if (!noteActivity) {
		noteApDeliverLogger.debug(`[reaction-resend] skip: noteActivity is null (note=${note.id})`);
		return;
	}

	const dm = new DeliverManager(note.user, noteActivity);
	await addNoteActivityDeliveryRecipes(dm, note);

	const noteInboxes = await dm.collectInboxes();
	noteApDeliverLogger.debug(
		`[reaction-resend] noteInboxes collected: ${noteInboxes.size} (note=${note.id})`,
	);
	await deliverToInboxes(note.user, noteActivity, noteInboxes);

	if (note.renote) {
		const sameRenoteCount =
			data.sameRenoteCount ??
			(await countSameRenotes(
				note.user.id,
				note.renote.id,
				note.id,
			));
		noteApDeliverLogger.debug(
			`[reaction-resend] renote detected: countSameRenotes=${sameRenoteCount} (note=${note.id}, renote=${note.renote.id})`,
		);
		if (sameRenoteCount === 0) {
			await delayReactionResend();
			await resendLocalReactionsForRenote(note.renote, noteInboxes);
		} else {
			noteApDeliverLogger.debug(
				`[reaction-resend] skip: countSameRenotes is not zero (note=${note.id}, renote=${note.renote.id})`,
			);
		}
	}

	if (["public"].includes(note.visibility)) {
		deliverToRelays(note.user, noteActivity);
	}

	noteApDeliverLogger.debug(
		`[note-deliver-metric] deliver_duration_ms=${Date.now() - startedAt} note=${note.id}`,
	);
}

async function renderNoteOrRenoteActivityFromNote(note: Note) {
	if (note.localOnly && note.channelId) return null;
	if (note.renote?.userId !== note.userId && note.renote?.localOnly) return null;

	const content =
		note.renote &&
		note.text == null &&
		!note.hasPoll &&
		note.fileIds.length === 0
			? renderAnnounce(
					note.renote.uri
						? note.renote.uri
						: `${config.url}/notes/${note.renote.id}`,
					note,
			  )
			: renderCreate(await renderNote(note, false), note);

	return renderActivity(content);
}

async function addNoteActivityDeliveryRecipes(dm: DeliverManager, note: Note) {
	const userIdsToFetch = new Set<User["id"]>();
	if (note.visibility === "specified" && note.visibleUserIds?.length) {
		for (const id of note.visibleUserIds as User["id"][]) userIdsToFetch.add(id);
	}
	if (note.mentions?.length) {
		for (const id of note.mentions as User["id"][]) userIdsToFetch.add(id);
	}
	if (note.reply && note.reply.userHost !== null) userIdsToFetch.add(note.reply.userId);
	if (note.renote && note.renote.userHost !== null) userIdsToFetch.add(note.renote.userId);
	if (["public", "home", "followers"].includes(note.visibility)) {
		if (note.reply && note.reply.userId === note.userId && note.reply.replyId) {
			if (
				note.reply.replyUserId !== note.userId &&
				note.reply.replyUserHost === null
			) {
				userIdsToFetch.add(note.reply.replyUserId);
			}
		} else if (
			note.reply &&
			note.reply.userId !== note.userId &&
			note.reply.userHost === null
		) {
			userIdsToFetch.add(note.reply.userId);
		}
	}
	const userMap = new Map<User["id"], User>();
	if (userIdsToFetch.size > 0) {
		const users = await Users.findBy({ id: In([...userIdsToFetch]) });
		for (const u of users) userMap.set(u.id, u);
	}

	if (note.visibility === "specified" && note.visibleUserIds?.length) {
		for (const id of note.visibleUserIds as User["id"][]) {
			const u = userMap.get(id);
			if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
		}
	}
	if (note.mentions?.length) {
		for (const id of note.mentions as User["id"][]) {
			const u = userMap.get(id);
			if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
		}
	}
	if (note.reply && note.reply.userHost !== null) {
		const u = userMap.get(note.reply.userId);
		if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
	}
	if (note.renote && note.renote.userHost !== null) {
		const u = userMap.get(note.renote.userId);
		if (u && Users.isRemoteUser(u)) dm.addDirectRecipe(u);
	}
	if (["public", "home", "followers"].includes(note.visibility)) {
		if (note.reply && note.reply.userId === note.userId && note.reply.replyId) {
			if (
				note.reply.replyUserId !== note.userId &&
				note.reply.replyUserHost === null
			) {
				noteApDeliverLogger.debug(`reReply deliver : ${note.reply.replyId}`);
				const u = userMap.get(note.reply.replyUserId);
				if (u) dm.addFollowersRecipe(u as ILocalUser);
			} else {
				noteApDeliverLogger.debug(`reReply deliver : ${note.reply.replyId}`);
				dm.addFollowersRecipe();
			}
		} else if (
			note.reply &&
			note.reply.userId !== note.userId &&
			note.reply.userHost === null
		) {
			noteApDeliverLogger.debug(`reply deliver : ${note.reply.id}`);
			const u = userMap.get(note.reply.userId);
			if (u) dm.addFollowersRecipe(u as ILocalUser);
		} else {
			dm.addFollowersRecipe();
		}
	}
}

async function getReactionEmojiMap(reactions: NoteReaction[]) {
	const emojiKeys = new Map<string, { name: string; host: string | null }>();

	for (const reaction of reactions) {
		const decoded = decodeReaction(reaction.reaction);
		if (!decoded.name) continue;
		const host = decoded.host ?? null;
		const key = `${decoded.name}@${host ?? ""}`;
		if (!emojiKeys.has(key)) {
			emojiKeys.set(key, { name: decoded.name, host });
		}
	}

	if (emojiKeys.size === 0) return new Map();

	const emojis = await Emojis.find({
		where: Array.from(emojiKeys.values()).map((entry) => ({
			name: entry.name,
			host: entry.host ?? IsNull(),
		})),
		select: ["name", "host", "license", "copyPermission"],
	});

	return new Map(emojis.map((emoji) => [`${emoji.name}@${emoji.host ?? ""}`, emoji]));
}

async function resendLocalReactionsForRenote(
	renote: Note,
	noteInboxes: Map<string, boolean>,
) {
	if (noteInboxes.size === 0) {
		noteApDeliverLogger.debug(
			`[reaction-resend] skip: noteInboxes is empty (renote=${renote.id})`,
		);
		return;
	}

	const reactions = await NoteReactions.createQueryBuilder("reaction")
		.leftJoinAndSelect("reaction.user", "user")
		.where("reaction.noteId = :noteId", { noteId: renote.id })
		.andWhere("user.host IS NULL")
		.orderBy("reaction.createdAt", "DESC")
		.addOrderBy("reaction.id", "DESC")
		.getMany();

	if (reactions.length === 0) {
		noteApDeliverLogger.debug(
			`[reaction-resend] skip: no local reactions (renote=${renote.id})`,
		);
		return;
	}
	const latestReactionsByUser = new Map<string, NoteReaction>();
	for (const reaction of reactions) {
		if (!latestReactionsByUser.has(reaction.userId)) {
			latestReactionsByUser.set(reaction.userId, reaction);
		}
	}

	const latestReactions = Array.from(latestReactionsByUser.values());
	noteApDeliverLogger.debug(
		`[reaction-resend] local reactions: ${latestReactions.length} (renote=${renote.id})`,
	);

	const emojiMap = await getReactionEmojiMap(latestReactions);

	// リノート作者がリモートのとき、1回だけ取得して全リアクションで使い回す
	const reactee =
		renote.userHost !== null
			? await Users.findOneBy({ id: renote.userId }).then((u) => u ?? null)
			: null;

	for (const reaction of latestReactions) {
		const reactionUser = reaction.user;
		if (!reactionUser || reactionUser.host !== null) continue;

		const decoded = decodeReaction(reaction.reaction);
		const emojiKey = decoded.name
			? `${decoded.name}@${decoded.host ?? ""}`
			: null;
		const emoji = emojiKey ? emojiMap.get(emojiKey) : null;
		const deliverReaction = await resolveApReaction(reaction.reaction, emoji);
		const deliverRecord = {
			...reaction,
			reaction: deliverReaction,
		} as NoteReaction;

		const activity = renderActivity(await renderLike(deliverRecord, renote));
		const dm = await buildReactionDeliverManager(
			reactionUser,
			renote,
			activity,
			{ disableUnion: true, reactee },
		);
		const reactionInboxes = await dm.collectInboxes();
		noteApDeliverLogger.debug(
			`[reaction-resend] deliver reaction: reactionInboxes=${reactionInboxes.size} (renote=${renote.id}, reaction=${reaction.id})`,
		);

		await deliverToInboxes(
			reactionUser as ILocalUser,
			activity,
			reactionInboxes,
		);
	}
}

async function delayReactionResend() {
	await new Promise((resolve) => setTimeout(resolve, 1000));
}
