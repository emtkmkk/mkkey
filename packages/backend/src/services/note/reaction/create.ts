import { publishNoteStream } from "@/services/stream.js";
import { renderLike } from "@/remote/activitypub/renderer/like.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import {
	toDbReaction,
	decodeReaction,
	resolveApReaction,
} from "@/misc/reaction-lib.js";
import type { User } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import {
	NoteReactions,
	Users,
	NoteWatchings,
	Notes,
	Emojis,
	Blockings,
	Instances,
	UserProfiles,
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
import {
	getCachedNormalizedReaction,
	setCachedNormalizedReaction,
} from "@/misc/reaction-normalize-cache.js";
import type { UserProfile } from "@/models/entities/user-profile.js";
import { checkReactionMute } from "@/misc/check-word-mute.js";
import { buildReactionDeliverManager } from "./deliver.js";

export default async (
	user: {
		id: User["id"];
		host: User["host"];
		username: User["username"];
		name: User["name"];
		avatarUrl: User["avatarUrl"];
		isSilenced: User["isSilenced"];
		driveCapacityOverrideMb: User["driveCapacityOverrideMb"];
		isExplorable: User["isExplorable"];
		isRemoteExplorable: User["isRemoteExplorable"];
		isBot: User["isBot"];
	},
	note: Note,
	reaction?: string,
) => {
	// Check blocking
	const blockPromise = (async () => {
		if (note.userId !== user.id) {
			const block = await Blockings.findOneBy({
				blockerId: note.userId,
				blockeeId: user.id,
			});
			if (block) {
				throw new IdentifiableError("e70412a4-7197-4726-8e74-f3e0deb92aa7");
			}
		}
	})();

	// check visibility
	const visibilityPromise = (async () => {
		if (!(await Notes.isVisibleForMe(note, user.id))) {
			throw new IdentifiableError(
				"68e9d2d1-48bf-42c2-b90a-b20e09fd3d48",
				"Note not accessible for you.",
			);
		}
	})();

	const relationPromise = (async () => {
		if (user.isSilenced && note.userId !== user.id) {
                        const relation = await Users.getRelation(
                                user.id,
                                note.userId,
                                note.user ?? undefined,
                        );
			if (relation && !relation.isFollowed) {
				throw new IdentifiableError(
					"5ab2b45b-c2b5-0560-793d-2a670084cc92",
					"サイレンス中はフォロワー以外にリアクション出来ません。",
				);
			}
		}
	})();

	const noteDeletedCheckPromise = (async () => {
		if (note.deletedAt) {
			throw new IdentifiableError(
				"639cc3a5-fe68-b071-0c20-413c887054cd",
				"削除された投稿に対してはリアクション出来ません。",
			);
		}
	})();

	// Await all initial checks concurrently
	await Promise.all([blockPromise, visibilityPromise, relationPromise, noteDeletedCheckPromise]);

	const rawReaction = reaction;
	const cachedReaction = await getCachedNormalizedReaction(
		user.host,
		note.userHost,
		rawReaction,
	);

	if (cachedReaction != null) {
		reaction = cachedReaction;
	} else {
		try {
			reaction = await toDbReaction(rawReaction, user.host, note.userHost);
			await setCachedNormalizedReaction(
				user.host,
				note.userHost,
				rawReaction,
				reaction,
			);
		} catch (err) {
			throw new IdentifiableError(
				"770a3ede-67d2-fc9d-f2e2-6163ba0443af",
				"指定された絵文字が存在しません。",
			);
		}
	}

	let isMutedReaction: boolean | { muted: boolean; reject?: boolean | undefined } = false;
	// Word mute
	const muteInfo = await UserProfiles.findOne({
		where: {
			userId: note.userId,
			enableReactionMute: true,
		},
		select: ["userId", "reactionMutedWords", "rejectMuteReaction"],
	});
	if (muteInfo) {
    isMutedReaction = checkReactionMute(
        reaction,
        note,
        user,
        muteInfo.reactionMutedWords,
    );
    console.log('isMutedReaction after checkReactionMute:', isMutedReaction);

    if (typeof isMutedReaction === "boolean") {
        isMutedReaction = { muted: isMutedReaction };
    }
    console.log('isMutedReaction after type check:', isMutedReaction);

    if (
        isMutedReaction.muted &&
        (isMutedReaction.reject ?? muteInfo.rejectMuteReaction)
    ) {
        throw new IdentifiableError(
            "119b8757-2ba5-385e-82cf-7fa4bc73c4d1",
            "投稿者のリアクションミュート設定の為、リアクションが拒否されました。",
        );
    }
    isMutedReaction = isMutedReaction.muted;
    console.log('Final isMutedReaction:', isMutedReaction);
	}


	const record: NoteReaction = {
		id: genId(),
		createdAt: new Date(),
		noteId: note.id,
		userId: user.id,
		reaction,
	};

	const existCount = await NoteReactions.count({
		where: {
			noteId: note.id,
			userId: user.id,
		},
	});

	if (existCount !== 0) {
		let maxReactionsPerAccount = 1;
		let maxReactionsNote = 1;
		if (!user.host) {
			maxReactionsPerAccount =
				(user.driveCapacityOverrideMb ?? 5120) > 5120
					? MAX_REACTION_PER_ACCOUNT
					: 1;
		} else {
			const instance = await Instances.findOneBy({ host: user.host });
			maxReactionsPerAccount = instance?.maxReactionsPerAccount ?? 1;
		}

		if (maxReactionsPerAccount >= 2) {
			const noteUser = await Users.findOneBy({ id: note.userId });

			if (!noteUser?.host) {
				maxReactionsNote = maxReactionsPerAccount;
			} else {
				const instance = await Instances.findOneBy({ host: noteUser.host });
				maxReactionsNote = instance?.maxReactionsPerAccount ?? 1;
				if (!user.host) maxReactionsPerAccount = maxReactionsNote;
			}
		}

		const maxReactions = Math.min(
			Math.max(Math.min(maxReactionsPerAccount, maxReactionsNote), 1),
			64,
		);

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
				throw new IdentifiableError("058b5325-c56c-99d1-9677-6eaeedd9f3f4");
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
		}
		throw e;
	}

	if (!isMutedReaction) {
		// Increment reactions count
		const sql = `jsonb_set("reactions", '{${reaction}}', (COALESCE("reactions"->>'${reaction}', '0')::int + 1)::text::jsonb)`;
		await Notes.createQueryBuilder()
			.update()
			.set({
				reactions: () => sql,
				...(existCount === 0
					? { score: () => `"score" + ${user.isBot ? "0" : user.host ? "1" : "3"}` }
					: {}),
			})
			.where("id = :id", { id: note.id })
			.execute();
	}

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
		select: ["name", "host", "originalUrl", "publicUrl", "license"],
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
		targetUserId: note.isPublicLikeList
			? !isMutedReaction
				? null
				: [user.id]
			: [user.id, note.userId],
	});

	// Create notification if the reaction target is a local user.
	if (note.userHost === null && !isMutedReaction) {
		createNotification(note.userId, "reaction", {
			notifierId: user.id,
			note: note,
			noteId: note.id,
			reaction: reaction,
		});
		const webhooks = await getActiveWebhooks().then((webhooks) =>
			webhooks.filter(
				(x) => x.userId === note.userId && x.on.includes("reaction"),
			),
		);

		for (const webhook of webhooks) {
			if (webhook.userId === user.id) continue;
			webhookDeliver(webhook, "reaction", {
				note: await Notes.pack(note, { id: note.userId }),
				reaction: {
					user: await Users.pack(user, { id: note.userId }),
					emojiName: decodedReaction.name
						? `:${decodedReaction.name}:`
						: reaction + (existCount > 0 ? ` (+${existCount})` : ""),
					customEmoji:
						decodedReaction.name && emoji != null ? emoji : undefined,
				},
			});
		}
	}

	if (!isMutedReaction) {
		// Fetch watchers
		const watchers = await NoteWatchings.findBy({
			noteId: note.id,
			userId: Not(user.id),
		});

		for (const watcher of watchers) {
			createNotification(watcher.userId, "reaction", {
				notifierId: user.id,
				note: note,
				noteId: note.id,
				reaction: reaction,
			});
		}

		//#region deliver
		if (
			Users.isLocalUser(user) &&
			!(note.channelId && note.localOnly) &&
			note.visibility !== "hidden"
		) {
			// ブラックリストに登録済みのホスト または リモート絵文字でライセンスにコピー拒否がある場合 は いいねに変更して外部に送信
			// TODO : リアクション解除時も変換をかけた方が良いかも
			record.reaction = await resolveApReaction(record.reaction, emoji);

			const content = renderActivity(await renderLike(record, note));
			const dm = await buildReactionDeliverManager(user, note, content);

			dm.execute();
		}
		//#endregion
	}
};
