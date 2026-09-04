import { IsNull } from "typeorm";
import define from "../../define.js";
import { Users } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { publishInternalEvent } from "@/services/stream.js";
import {
	DEFAULT_DRIVE_SIZE,
	EMOJI_DRIVE_GRANT_MB,
	MAX_DRIVE_SIZE,
	MAX_EMOJI_DRIVE_GRANTS,
	MB,
} from "@/const.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,

	description:
		"自作絵文字ボーナスを1回分適用する。ドライブ容量を加算し、適用回数を1つ進める。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		username: { type: "string" },
		/** 適用理由のメモ。モデレーションログにだけ残る。 */
		note: { type: "string", maxLength: 256 },
	},
	required: ["username"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({
		usernameLower: ps.username.toLowerCase(),
		host: IsNull(),
	});

	if (user == null) {
		throw new Error("user not found");
	}

	const used = user.emojiDriveGrantCount;

	if (used >= MAX_EMOJI_DRIVE_GRANTS) {
		throw new Error(
			`already used all ${MAX_EMOJI_DRIVE_GRANTS} grants (used: ${used})`,
		);
	}

	const beforeMb = user.driveCapacityOverrideMb;
	const afterMb = Math.min(
		(beforeMb ?? DEFAULT_DRIVE_SIZE / MB) + EMOJI_DRIVE_GRANT_MB,
		MAX_DRIVE_SIZE / MB,
	);

	// 同時実行で上限を超えないよう、回数の条件を UPDATE 側にも持たせる
	const updated = await Users.createQueryBuilder()
		.update()
		.set({
			driveCapacityOverrideMb: afterMb,
			emojiDriveGrantCount: () => '"emojiDriveGrantCount" + 1',
		})
		.where("id = :id", { id: user.id })
		.andWhere('"emojiDriveGrantCount" = :used', { used })
		.execute();

	if (updated.affected === 0) {
		throw new Error("grant count changed concurrently, retry");
	}

	publishInternalEvent("localUserUpdated", { id: user.id });
	await Users.invalidateMeDetailedBaseCache(user.id);
	await Users.invalidateUserShowDetailedCache(user.id);

	await insertModerationLog(me, "grant-emoji-bonus", {
		targetId: user.id,
		username: user.username,
		used: used + 1,
		max: MAX_EMOJI_DRIVE_GRANTS,
		grantMb: EMOJI_DRIVE_GRANT_MB,
		beforeMb,
		afterMb,
		note: ps.note,
	});

	return {
		username: user.username,
		used: used + 1,
		max: MAX_EMOJI_DRIVE_GRANTS,
		remaining: MAX_EMOJI_DRIVE_GRANTS - (used + 1),
		grantMb: EMOJI_DRIVE_GRANT_MB,
		beforeMb,
		afterMb,
	};
});
