/**
 * 絵文字インポート申請を作成する（ユーザー向け）。
 * 1日10回制限（UTC 0:00リセット）。否認リスト・同一名で pending があれば拒否。
 * 申請作成時に管理者（isAdmin）にのみ通知する（モデレーターには送らない）。通知の種類は emojiRequest（押すと審査画面のこの申請が開く）。
 *
 * @public
 */
import { IsNull, MoreThanOrEqual } from "typeorm";
import define from "../../define.js";
import { EmojiImportRequests, EmojiImportDenieds, Emojis, Users } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { notifyEmojiRequestReviewers } from "@/services/emoji-request-notification.js";
import { ApiError } from "../../error.js";
import { toPuny } from "@/misc/convert-host.js";

const DAILY_LIMIT = 10;

function getStartOfTodayUTC(): Date {
	const now = new Date();
	return new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate(),
			0,
			0,
			0,
			0,
		),
	);
}

export const meta = {
	tags: ["emoji-import-request"],
	requireCredential: true,
	kind: "write:account",
	errors: {
		emojiDenied: {
			message: "この絵文字名はインポート申請が否認されています。",
			code: "EMOJI_DENIED",
			id: "a1b2c3d4-emoji-denied",
		},
		sameNamePending: {
			message: "同じ絵文字名で申請が審査中です。",
			code: "SAME_NAME_PENDING",
			id: "a1b2c3d4-same-name-pending",
		},
		dailyLimitExceeded: {
			message: "本日の申請回数の上限に達しました。",
			code: "DAILY_LIMIT_EXCEEDED",
			id: "a1b2c3d4-daily-limit",
		},
	},
	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			id: { type: "string", format: "id" },
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		emojiName: { type: "string", minLength: 1, maxLength: 128 },
		emojiHost: { type: "string", minLength: 1, maxLength: 128 },
	},
	required: ["emojiName", "emojiHost"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const emojiName = ps.emojiName.trim();
	const emojiHost = toPuny(ps.emojiHost);

	// 否認リストチェック
	const denied = await EmojiImportDenieds.findOneBy({ name: emojiName });
	if (denied) {
		throw new ApiError(meta.errors.emojiDenied);
	}

	// 同一 emojiName で誰かが pending
	const pendingSameName = await EmojiImportRequests.findOneBy({
		emojiName,
		status: "pending",
	});
	if (pendingSameName) {
		throw new ApiError(meta.errors.sameNamePending);
	}

	// 日次上限
	const startOfToday = getStartOfTodayUTC();
	const todayCount = await EmojiImportRequests.countBy({
		requesterId: me.id,
		createdAt: MoreThanOrEqual(startOfToday),
	});
	if (todayCount >= DAILY_LIMIT) {
		throw new ApiError(meta.errors.dailyLimitExceeded);
	}

	// リモート絵文字の存在確認
	const remoteEmoji = await Emojis.findOneBy({
		name: emojiName,
		host: emojiHost,
	});
	if (!remoteEmoji) {
		throw new ApiError({
			message: "その絵文字は存在しません。",
			code: "NO_SUCH_EMOJI",
			id: "a1b2c3d4-no-such-emoji",
		});
	}

	const request = await EmojiImportRequests.insert({
		id: genId(),
		createdAt: new Date(),
		emojiName,
		emojiHost,
		requesterId: me.id,
		status: "pending",
		reason: null,
		processedById: null,
		importedEmojiId: null,
		processedAt: null,
	}).then((x) =>
		EmojiImportRequests.findOneByOrFail(x.identifiers[0]),
	);

	// 管理者のみに通知（モデレーターには送らない）。通知の種類は emojiRequest で、押すと審査画面のこの申請が開く
	notifyEmojiRequestReviewers({
		kind: "import",
		requestId: request.id,
		header: "絵文字インポート申請がありました",
		body: `:${emojiName}@${emojiHost}: のインポート申請が届きました。\nタップして確認してください。`,
		icon: remoteEmoji.publicUrl || remoteEmoji.originalUrl,
	}, me.id);

	return { id: request.id };
});
