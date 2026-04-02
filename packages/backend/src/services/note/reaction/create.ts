/**
 * @packageDocumentation
 *
 * リアクション作成サービス。
 *
 * @remarks
 * - **役割**: API や AP の Like 受信時にリアクションを DB に保存し、通知・配信を行う。
 *
 * @see {@link server/api/endpoints/notes/reactions} リアクション API
 * @internal
 */
import { publishInternalEvent, publishNoteStream } from "@/services/stream.js";
import { renderLike } from "@/remote/activitypub/renderer/like.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import {
	toDbReaction,
	decodeReaction,
	resolveApReaction,
} from "@/misc/reaction-lib.js";
import { canUseEmoji } from "@/models/repositories/emoji.js";
import type { User } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import {
	NoteReactions,
	Users,
	NoteWatchings,
	Notes,
	Emojis,
	Followings,
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
import { Cache } from "@/misc/cache.js";

const INSTANCE_MAX_REACTIONS_CACHE_TTL_MS = 30 * 1000;
const instanceMaxReactionsPerAccountCache = new Cache<number>(
	INSTANCE_MAX_REACTIONS_CACHE_TTL_MS,
);
const localUserDriveCapacityCache = new Cache<number | null>(
	INSTANCE_MAX_REACTIONS_CACHE_TTL_MS,
);

export function normalizeReactionMuteResult(
	muteResult: boolean | { muted: boolean; reject?: boolean | undefined },
	defaultReject: boolean,
): { isMutedReaction: boolean; shouldReject: boolean } {
	const normalized =
		typeof muteResult === "boolean" ? { muted: muteResult } : muteResult;
	const shouldReject =
		normalized.muted && (normalized.reject ?? defaultReject);

	return {
		isMutedReaction: normalized.muted,
		shouldReject,
	};
}

export function evaluateReactionLimit(params: {
	existCount: number;
	maxReactions: number;
	reaction: string;
	existingReaction?: string;
}): "allow" | "replace" | "duplicate_error" | "limit_error" {
	if (params.existCount < params.maxReactions) {
		return "allow";
	}

	if (params.maxReactions !== 1) {
		return "limit_error";
	}

	if (params.existingReaction == null || params.existingReaction === params.reaction) {
		return "duplicate_error";
	}

	return "replace";
}

async function getMaxReactionsPerAccountByHost(host: string): Promise<number> {
	return await instanceMaxReactionsPerAccountCache.fetch(
		host,
		async () => {
			const instance = await Instances.findOne({
				where: { host },
				select: ["maxReactionsPerAccount"],
			});
			return instance?.maxReactionsPerAccount ?? 1;
		},
	);
}

async function getLocalUserMaxReactionsPerAccount(userId: string): Promise<number> {
	const driveCapacityOverrideMb = await localUserDriveCapacityCache.fetch(
		userId,
		async () => {
			const localUser = await Users.findOne({
				where: { id: userId },
				select: ["id", "driveCapacityOverrideMb"],
			});
			return localUser?.driveCapacityOverrideMb ?? null;
		},
	);

	return (driveCapacityOverrideMb ?? 5120) > 5120
		? MAX_REACTION_PER_ACCOUNT
		: 1;
}

export default async (
	user: {
		id: User["id"];
		host: User["host"];
		username: User["username"];
		name: User["name"];
		avatarUrl: User["avatarUrl"];
		isSilenced: User["isSilenced"];
		isExplorable: User["isExplorable"];
		isRemoteExplorable: User["isRemoteExplorable"];
		isBot: User["isBot"];
	},
	note: Note,
	reaction?: string,
) => {
	// ブロック関係を確認
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

	// 公開範囲を確認
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
				false,
			);
		}
	})();

	/** 警告ユーザが、未フォローかつ投稿者が受容していないノートにリアクションできない */
	const warnedViewerReactionPromise = (async () => {
		const reactor = await Users.findOneBy({
			id: user.id,
			select: { id: true, isModerationWarning: true },
		});
		if (reactor?.isModerationWarning !== true) return;
		if (note.userId === user.id) return;
		const authorFollowsViewer = await Followings.exist({
			where: { followerId: note.userId, followeeId: user.id },
		});
		if (authorFollowsViewer) return;
		const noteAuthor =
			note.user ?? (await Users.findOneBy({ id: note.userId }));
		if (noteAuthor?.host != null) {
			throw new IdentifiableError(
				"a1f2e3d4-c5b6-4789-a012-3456789abcde",
				"この投稿では警告ユーザからのリアクションは受け付けていません。",
				false,
			);
		}
		const authorProfile = await UserProfiles.findOneBy({
			userId: note.userId,
		});
		if (authorProfile?.receiveReactionsFromNonFollowedWarnedUsers !== true) {
			throw new IdentifiableError(
				"a1f2e3d4-c5b6-4789-a012-3456789abcde",
				"この投稿では警告ユーザからのリアクションは受け付けていません。",
				false,
			);
		}
	})();

	// 初期チェックをすべて並列で待機
	await Promise.all([
		blockPromise,
		visibilityPromise,
		relationPromise,
		noteDeletedCheckPromise,
		warnedViewerReactionPromise,
	]);

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

	// カスタム絵文字の使用権限（usageVisibility・モチーフ）をチェック（ローカルユーザ＋ローカル絵文字のみ。リモートは対象外）
	const customMatch = reaction.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/);
	if (customMatch && !user.host) {
		const decoded = decodeReaction(reaction);
		const emojiHost = decoded.host == null || decoded.host === "." ? IsNull() : decoded.host;
		const emoji = await Emojis.findOne({
			where: { name: decoded.name, host: emojiHost },
			select: [
				"host",
				"usageVisibility",
				"allowedUserIds",
				"motifUserId",
				"motifUserMode",
				"category",
			],
		});
		if (emoji && emoji.host == null) {
			let followeeIds = new Set<string>();
			if (
				!user.host &&
				emoji.motifUserId != null &&
				(emoji.motifUserMode ?? "any") === "follow"
			) {
				const isFollowed = await Followings.exist({
					where: {
						followerId: user.id,
						followeeId: emoji.motifUserId,
					},
				});
				if (isFollowed) followeeIds.add(emoji.motifUserId);
			}
			if (!canUseEmoji(emoji, user, followeeIds)) {
				throw new IdentifiableError(
					"770a3ede-67d2-fc9d-f2e2-6163ba0443af",
					"指定された絵文字が存在しません。",
				);
			}
		}
	}

	let isMutedReaction: boolean | { muted: boolean; reject?: boolean | undefined } = false;
	// ワードミュート
	const muteInfo = await UserProfiles.findOne({
		where: {
			userId: note.userId,
			enableReactionMute: true,
		},
		select: ["userId", "reactionMutedWords", "rejectMuteReaction"],
	});
	if (muteInfo) {
		const muteResult = checkReactionMute(
			reaction,
			note,
			user,
			muteInfo.reactionMutedWords,
		);
		const normalizedMute = normalizeReactionMuteResult(
			muteResult,
			muteInfo.rejectMuteReaction,
		);

		if (normalizedMute.shouldReject) {
			throw new IdentifiableError(
				"119b8757-2ba5-385e-82cf-7fa4bc73c4d1",
				"投稿者のリアクションミュート設定の為、リアクションが拒否されました。",
				false,
			);
		}

		isMutedReaction = normalizedMute.isMutedReaction;
	}


	const record: NoteReaction = {
		id: genId(),
		createdAt: new Date(),
		noteId: note.id,
		userId: user.id,
		reaction,
	};

	const existingReactions = await NoteReactions.find({
		where: {
			noteId: note.id,
			userId: user.id,
		},
		select: ["reaction"],
	});
	const existCount = existingReactions.length;
	const existingReaction = existingReactions[0]?.reaction;

	if (existCount !== 0) {
		let maxReactionsPerAccount = 1;
		let maxReactionsNote = 1;
		if (!user.host) {
			maxReactionsPerAccount = await getLocalUserMaxReactionsPerAccount(user.id);
		} else {
			maxReactionsPerAccount = await getMaxReactionsPerAccountByHost(user.host);
		}

		if (maxReactionsPerAccount >= 2) {
			if (!note.userHost) {
				maxReactionsNote = maxReactionsPerAccount;
			} else {
				maxReactionsNote = await getMaxReactionsPerAccountByHost(note.userHost);
				if (!user.host) maxReactionsPerAccount = maxReactionsNote;
			}
		}

		const maxReactions = Math.min(
			Math.max(Math.min(maxReactionsPerAccount, maxReactionsNote), 1),
			64,
		);

		const limitResult = evaluateReactionLimit({
			existCount,
			maxReactions,
			reaction,
			existingReaction,
		});

		if (limitResult === "replace") {
			// 別のリアクションがすでにされていたら置き換える
			if (existingReaction == null) {
				throw new IdentifiableError("51c42bb4-931a-456b-bff7-e5a8a70dd298");
			}
			await deleteReaction(user, note, existingReaction);
		} else if (limitResult === "duplicate_error") {
			// 同じリアクションがすでにされていたらエラー
			throw new IdentifiableError("51c42bb4-931a-456b-bff7-e5a8a70dd298");
		} else if (limitResult === "limit_error") {
			// 絵文字上限超過エラー
			throw new IdentifiableError("058b5325-c56c-99d1-9677-6eaeedd9f3f4");
		}
	}

	// リアクションを作成
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
		// リアクション数をインクリメント
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
		select: ["name", "host", "originalUrl", "publicUrl", "license", "copyPermission"],
	});

	publishInternalEvent("notePackReactionUpdated", {
		userId: user.id,
		noteId: note.id,
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

	// リアクション先がローカルユーザーの場合は通知を作成
	if (note.userHost === null && !isMutedReaction) {
		createNotification(note.userId, "reaction", {
			notifierId: user.id,
			note: note,
			noteId: note.id,
			reaction: reaction,
		}, { notifier: user });
		const webhooks = await getActiveWebhooks().then((webhooks) =>
			webhooks.filter(
				(x) => x.userId === note.userId && x.on.includes("reaction"),
			),
		);

		const targets = webhooks.filter((w) => w.userId !== user.id);
		const packedNote =
			targets.length > 0
				? await Notes.pack(note, { id: note.userId })
				: null;
		const packedUser =
			targets.length > 0
				? await Users.pack(user.id, { id: note.userId })
				: null;
		for (const webhook of webhooks) {
			if (webhook.userId === user.id) continue;
			webhookDeliver(webhook, "reaction", {
				note: packedNote!,
				reaction: {
					user: packedUser!,
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
		// ウォッチャーを取得
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
			}, { notifier: user });
		}

		//#region 配信
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
