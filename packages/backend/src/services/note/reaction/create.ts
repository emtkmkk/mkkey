import { publishNoteStream } from "@/services/stream.js";
import { renderLike } from "@/remote/activitypub/renderer/like.js";
import DeliverManager from "@/remote/activitypub/deliver-manager.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { toDbReaction, decodeReaction, getFallbackReaction } from "@/misc/reaction-lib.js";
import type { User, IRemoteUser, ILocalUser } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import {
	NoteReactions,
	Users,
	NoteWatchings,
	Notes,
	Emojis,
	Blockings,
	Instances,
} from "@/models/index.js";
import { IsNull, Not } from "typeorm";
import { perUserReactionsChart } from "@/services/chart/index.js";
import { genId } from "@/misc/gen-id.js";
import { createNotification } from "../../create-notification.js";
import deleteReaction from "./delete.js";
import { isDuplicateKeyValueError } from "@/misc/is-duplicate-key-value-error.js";
import type { NoteReaction } from "@/models/entities/note-reaction.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import { webhookDeliver } from "@/queue/index.js";
import { getActiveWebhooks } from "@/misc/webhook-cache.js";
import { MAX_REACTION_PER_ACCOUNT } from "@/const.js";

export default async (
	user: { id: User["id"]; host: User["host"]; username: User["username"]; name: User["name"]; avatarUrl: User["avatarUrl"]; isSilenced: User["isSilenced"]; driveCapacityOverrideMb: User["driveCapacityOverrideMb"]; },
	note: Note,
	reaction?: string,
) => {
	// Check blocking
	if (note.userId !== user.id) {
		const block = await Blockings.findOneBy({
			blockerId: note.userId,
			blockeeId: user.id,
		});
		if (block) {
			throw new IdentifiableError("e70412a4-7197-4726-8e74-f3e0deb92aa7");
		}
	}

	// check visibility
	if (!(await Notes.isVisibleForMe(note, user.id))) {
		throw new IdentifiableError(
			"68e9d2d1-48bf-42c2-b90a-b20e09fd3d48",
			"Note not accessible for you.",
		);
	}

	const relation = user.isSilenced ? note.userId !== user.id ? await Users.getRelation(user.id, note.userId) : undefined : undefined;

	if (user.isSilenced && (!note.user.isFollowed && !relation.isFollowed)) {
		throw new IdentifiableError(
			"5ab2b45b-c2b5-0560-793d-2a670084cc92",
			"サイレンス中はフォロワー以外にリアクション出来ません。",
		);
	}

	if (
		note.deletedAt
	) {		
		throw new IdentifiableError(
			"639cc3a5-fe68-b071-0c20-413c887054cd",
			"削除された投稿に対してはリアクション出来ません。",
		);
	}

	// TODO: cache
	reaction = await toDbReaction(reaction, user.host, note.user?.host);

	const record: NoteReaction = {
		id: genId(),
		createdAt: new Date(),
		noteId: note.id,
		userId: user.id,
		reaction,
	};

	const existCount = await NoteReactions.count({where: {
			noteId: note.id,
			userId: user.id,
		}
	});

	if (existCount != 0) {
		let maxReactionsPerAccount = 1;
		let maxReactionsNote = 1;
		if (!user.host) {
			maxReactionsPerAccount = user.driveCapacityOverrideMb > 5120 ? MAX_REACTION_PER_ACCOUNT : 1;
		} else {
			const instance = await Instances.findOneBy({ host: user.host });
			maxReactionsPerAccount = instance.maxReactionsPerAccount;
		}

		if (maxReactionsPerAccount >= 2) {
			const noteUser = await Users.findOneBy({ id: note.userId });

			if (!noteUser?.host) {
				maxReactionsNote = maxReactionsPerAccount;
			} else {
				const instance = await Instances.findOneBy({ host: noteUser.host });
				maxReactionsNote = instance.maxReactionsPerAccount;
				if (!user.host) maxReactionsPerAccount = maxReactionsNote;
			}
		}

		const maxReactions = Math.min(Math.max(Math.min(maxReactionsPerAccount, maxReactionsNote), 1), 64);

		if (existCount >= maxReactions) {
			if (maxReactions === 1) {
				const exists = await NoteReactions.findOneByOrFail({
					noteId: note.id,
					userId: user.id,
				});

				if (exists.reaction !== reaction) {
					// 別のリアクションがすでにされていたら置き換える
					await deleteReaction(user, note, exists.reaction);
				} else {
					// 同じリアクションがすでにされていたらエラー
					throw new IdentifiableError("51c42bb4-931a-456b-bff7-e5a8a70dd298");
				}
			} else {
				// 絵文字上限超過エラー
				throw new IdentifiableError("51c42bb4-931a-456b-bff7-e5a8a70dd298");
			}
		}
	}

	// Create reaction
	try {
		await NoteReactions.insert(record);
	} catch (e) {
		if (isDuplicateKeyValueError(e)) {
			/*const exists = await NoteReactions.findOneByOrFail({
				noteId: note.id,
				userId: user.id,
			});

			if (exists.reaction !== reaction) {
				// 別のリアクションがすでにされていたら置き換える
				await deleteReaction(user, note);
				await NoteReactions.insert(record);
			} else {*/
			// 同じリアクションがすでにされていたらエラー
			throw new IdentifiableError("51c42bb4-931a-456b-bff7-e5a8a70dd298");
			//}
		} else {
			throw e;
		}
	}

	// Increment reactions count
	const sql = `jsonb_set("reactions", '{${reaction}}', (COALESCE("reactions"->>'${reaction}', '0')::int + 1)::text::jsonb)`;
	await Notes.createQueryBuilder()
		.update()
		.set({
			reactions: () => sql,
			...(existCount === 0 ? {score: () => `"score" + ${user.host ? '1' : '3'}`} : {}),
		})
		.where("id = :id", { id: note.id })
		.execute();

	perUserReactionsChart.update(user, note);

	// リアクション時、ユーザの最終更新時刻を更新
	Users.update(user.id, {
		lastActiveDate: new Date(),
	});

	// カスタム絵文字リアクションだったら絵文字情報も送る
	const decodedReaction = decodeReaction(reaction);

	const emoji = await Emojis.findOne({
		where: {
			name: decodedReaction.name,
			host: decodedReaction.host ?? IsNull(),
		},
		select: ["name", "host", "originalUrl", "publicUrl"],
	});

	publishNoteStream(note.id, "reacted", {
		reaction: decodedReaction.reaction,
		emoji:
			emoji != null
				? {
					name: emoji.host
						? `${emoji.name}@${emoji.host}`
						: `${emoji.name}@.`,
					url: emoji.publicUrl || emoji.originalUrl, // || emoji.originalUrl してるのは後方互換性のため
				}
				: null,
		userId: user.id,
	});

	// Create notification if the reaction target is a local user.
	if (note.userHost === null) {
		createNotification(note.userId, "reaction", {
			notifierId: user.id,
			note: note,
			noteId: note.id,
			reaction: reaction,
		});
		const webhooks = await getActiveWebhooks().then((webhooks) =>
			webhooks.filter((x) => x.userId === note.userId && x.on.includes("reaction")),
		);

		for (const webhook of webhooks) {
			webhookDeliver(webhook, "reaction", {
				note: await Notes.pack(note, user),
				reaction: {
					user: user,
					emojiName: decodedReaction.name ? `:${decodedReaction.name}:` : reaction + (existCount > 0 ? ` (+${existCount})` : ""),
					customEmoji: decodedReaction.name ? emoji : undefined,
				}
			});
		}

	}

	// Fetch watchers
	NoteWatchings.findBy({
		noteId: note.id,
		userId: Not(user.id),
	}).then((watchers) => {
		for (const watcher of watchers) {
			createNotification(watcher.userId, "reaction", {
				notifierId: user.id,
				note: note,
				noteId: note.id,
				reaction: reaction,
			});
		}
	});

	//#region deliver
	if (
		Users.isLocalUser(user) &&
		!(note.channelId && note.localOnly) &&
		note.visibility !== "hidden"
	) {
		// ブラックリストに登録済みのホスト または リモート絵文字でライセンスにコピー拒否がある場合 は いいねに変更して外部に送信
		// TODO : リアクション解除時も変換をかけた方が良いかも
		if (["voskey.icalo.net","9ineverse.com"].includes(emoji?.host) || (emoji?.host && emoji?.license?.includes("コピー可否 : deny"))) record.reaction = await getFallbackReaction()

		const content = renderActivity(await renderLike(record, note));
		const dm = new DeliverManager(user, content);
		if (note.userHost !== null) {
			const reactee = await Users.findOneBy({ id: note.userId });
			dm.addDirectRecipe(reactee as IRemoteUser);
		}

		if (["public", "home", "followers"].includes(note.visibility)) {
			if (note.userId !== user.id && note.userHost === null) {
				const u = await Users.findOneBy({ id: note.userId });
				dm.addFollowersRecipe(u as ILocalUser);
			} else {
				dm.addFollowersRecipe();
			}
		} else if (note.visibility === "specified") {
			const visibleUsers = await Promise.all(
				note.visibleUserIds.map((id) => Users.findOneBy({ id })),
			);
			for (const u of visibleUsers.filter((u) => u && Users.isRemoteUser(u))) {
				dm.addDirectRecipe(u as IRemoteUser);
			}
		}

		dm.execute();
	}
	//#endregion
};
