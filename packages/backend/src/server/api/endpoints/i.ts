/**
 * @packageDocumentation
 *
 * 認証ユーザー本人（MeDetailed）を返す API。Redis で base / volatile / merged を分割キャッシュする。
 *
 * @remarks
 * `needsModerationWarningPopup` は UTC 日付で変わるため **merged キャッシュには含めず**、応答直前に毎回付与する。
 * 当日 true の間は認証 API ルータで他エンドポイントが 403 となり、ユーザーは本レスポンスと `i/ack-moderation-warning`（および起動用 `auth/validate`）のみ利用可能。
 * 付与判定では認証済み `user.isModerationWarning` を使い、通常ユーザ向けに `user` 行の再読みを避ける（鮮度は認証キャッシュと同じ。管理側の付け外しは `localUserUpdated` でキャッシュ無効化）。
 *
 * @internal
 */
import { redisClient } from "@/db/redis.js";
import { isModerationWarningAckPending } from "@/misc/moderation-warning-ack.js";
import { ModerationWarningPopupAcks, Users } from "@/models/index.js";
import type { ILocalUser } from "@/models/entities/user.js";
import type { MeDetailedVolatile } from "@/models/repositories/user.js";
import define from "../define.js";

const meDetailedVolatileKeys = [
	"hasUnreadSpecifiedNotes",
	"hasUnreadMentions",
	"hasUnreadAnnouncement",
	"hasUnreadAntenna",
	"hasUnreadChannel",
	"hasUnreadMessagingMessage",
	"hasUnreadNotification",
	"hasPendingReceivedFollowRequest",
] as const;

export const meta = {
	tags: ["account"],

	requireCredential: true,

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "MeDetailed",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

function extractMeDetailedVolatile(src: Record<string, unknown>): MeDetailedVolatile {
	return {
		hasUnreadSpecifiedNotes: Boolean(src.hasUnreadSpecifiedNotes),
		hasUnreadMentions: Boolean(src.hasUnreadMentions),
		hasUnreadAnnouncement: Boolean(src.hasUnreadAnnouncement),
		hasUnreadAntenna: Boolean(src.hasUnreadAntenna),
		hasUnreadChannel: Boolean(src.hasUnreadChannel),
		hasUnreadMessagingMessage: Boolean(src.hasUnreadMessagingMessage),
		hasUnreadNotification: Boolean(src.hasUnreadNotification),
		hasPendingReceivedFollowRequest: Boolean(src.hasPendingReceivedFollowRequest),
	};
}

function createMeDetailedBase(src: Record<string, unknown>): Record<string, unknown> {
	const base = { ...src };

	for (const key of meDetailedVolatileKeys) {
		delete base[key];
	}

	return base;
}

/**
 * 当日分の警告ポップアップが必要なら `needsModerationWarningPopup: true` を付与する。
 * キャッシュ済み merged に古いキーが残っていても削除する。
 *
 * @remarks
 * 警告フラグは認証済み `user` を信頼し `Users.findOne` しない（通常ユーザの `/i` で PK 読みを省く）。
 * 警告ユーザのみ `moderation_warning_popup_ack` を1回読む。
 */
async function attachModerationWarningPopup(
	merged: Record<string, unknown>,
	user: ILocalUser,
): Promise<void> {
	delete merged.needsModerationWarningPopup;
	if (user.isModerationWarning !== true) {
		return;
	}
	const ack = await ModerationWarningPopupAcks.findOneBy({ userId: user.id });
	if (
		!isModerationWarningAckPending({
			isModerationWarning: true,
			moderationWarningPopupAt: ack?.acknowledgedAt,
		})
	) {
		return;
	}
	merged.needsModerationWarningPopup = true;
}

export default define(meta, paramDef, async (ps, user, token) => {
	const isSecure = token == null;
	const userId = user.id;

	const mergedCacheKey = Users.getMeDetailedMergedCacheKey(userId, isSecure);
	const mergedCache = await redisClient.get(mergedCacheKey);

	if (mergedCache != null) {
		const merged = JSON.parse(mergedCache) as Record<string, unknown>;
		await attachModerationWarningPopup(merged, user);
		return merged;
	}

	const baseCacheKey = Users.getMeDetailedBaseCacheKey(userId, isSecure);
	const volatileCacheKey = Users.getMeDetailedVolatileCacheKey(userId);

	let base: Record<string, unknown> | null = null;
	const baseCache = await redisClient.get(baseCacheKey);

	if (baseCache != null) {
		base = JSON.parse(baseCache) as Record<string, unknown>;
	}

	if (base == null) {
		// まとめ読み: Me を avatar/banner 付きで 1 回取得し hint で渡して drive_file の個別参照を削減
		const meWithRelations = await Users.findOne({
			where: { id: userId },
			relations: { avatar: true, banner: true },
		});
		const me = (await Users.pack<true, true>(
			userId,
			user,
			{
				detail: true,
				includeSecrets: isSecure,
			},
			meWithRelations != null ? { user: meWithRelations } : undefined,
		)) as unknown as Record<string, unknown>;
		base = createMeDetailedBase(me);

		await redisClient.set(
			baseCacheKey,
			JSON.stringify(base),
			"EX",
			Users.getMeDetailedBaseCacheTtlSec(),
		);
	}

	let volatile: MeDetailedVolatile | null = null;
	const volatileCache = await redisClient.get(volatileCacheKey);

	if (volatileCache != null) {
		volatile = extractMeDetailedVolatile(
			JSON.parse(volatileCache) as Record<string, unknown>,
		);
	}

	if (volatile == null) {
		volatile = await Users.getMeDetailedVolatile(userId);
		await redisClient.set(
			volatileCacheKey,
			JSON.stringify(volatile),
			"EX",
			Users.getMeDetailedVolatileCacheTtlSec(),
		);
	}

	const merged = {
		...base,
		...volatile,
	};

	await redisClient.set(
		mergedCacheKey,
		JSON.stringify(merged),
		"EX",
		Users.getMeDetailedMergedCacheTtlSec(),
	);

	await attachModerationWarningPopup(merged, user);

	return merged;
});
