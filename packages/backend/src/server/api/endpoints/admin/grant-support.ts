import { In, IsNull } from "typeorm";
import define from "../../define.js";
import { Users, UserSupports } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { publishInternalEvent } from "@/services/stream.js";
import { DEFAULT_DRIVE_SIZE, MAX_DRIVE_SIZE, MB } from "@/const.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:support",

	description:
		"月ごとの支援をまとめて反映する。ドライブ容量を加算し、その月の支援実績を記録する。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		/** 対象月。`YYYY-MM`。 */
		month: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
		/** true のとき記録も更新も行わず、結果の見込みだけを返す。 */
		dryRun: { type: "boolean", default: false },
		/**
		 * 何ヶ月分を加算するか。反映を忘れて数ヶ月分をまとめて処理するとき用。
		 *
		 * 全員に一律で掛かる。途中から加入した人には多く付くが、
		 * これを使うのは反映を忘れたときだけなので、そこは割り切っている。
		 * 記録は `month` の1行だけで、過去月の行は作らない。
		 */
		months: { type: "integer", minimum: 1, maximum: 24, default: 1 },
		entries: {
			type: "array",
			minItems: 1,
			maxItems: 500,
			items: {
				type: "object",
				properties: {
					username: { type: "string" },
					/** 1ヶ月あたりの加算量。実際に加算されるのは これ × months。 */
					grantMb: { type: "integer", minimum: 0, maximum: MAX_DRIVE_SIZE / MB },
					source: { type: "string", maxLength: 32, default: "ofuse" },
					externalId: { type: "string", maxLength: 128, nullable: true },
					plans: {
						type: "array",
						items: { type: "string", maxLength: 128 },
						default: [],
					},
				},
				required: ["username", "grantMb"],
			},
		},
	},
	required: ["month", "entries"],
} as const;

type Result = {
	username: string;
	status: "applied" | "skipped" | "not-found";
	/** skipped の理由。すでにその月を適用済み、など。 */
	reason?: string;
	beforeMb?: number | null;
	afterMb?: number;
	/** 実際に加算した合計（1ヶ月あたり × months）。 */
	grantMb?: number;
	months?: number;
};

export default define(meta, paramDef, async (ps, me) => {
	const { month, dryRun } = ps;

	// 同じユーザーが二度入っていると、同一トランザクション内で二重加算しうるので弾く
	const usernames = ps.entries.map((e) => e.username.toLowerCase());
	const duplicated = usernames.filter((u, i) => usernames.indexOf(u) !== i);
	if (duplicated.length > 0) {
		throw new Error(
			`duplicated usernames in entries: ${[...new Set(duplicated)].join(", ")}`,
		);
	}

	const users = await Users.findBy({
		usernameLower: In(usernames),
		host: IsNull(),
	});
	// `usernameLower` は select: false なので、絞り込みには使えても取得結果には入らない。
	// 突き合わせは取得できる `username` を小文字化して行う。
	const userByName = new Map(users.map((u) => [u.username.toLowerCase(), u]));

	// その月にすでに記録がある人は対象から外す（二重適用の防止）
	const alreadyApplied = new Set(
		users.length === 0
			? []
			: (
					await UserSupports.findBy({
						userId: In(users.map((u) => u.id)),
						month,
					})
			  ).map((s) => s.userId),
	);

	const results: Result[] = [];
	const appliedAt = new Date();

	for (const entry of ps.entries) {
		const user = userByName.get(entry.username.toLowerCase());

		if (user == null) {
			results.push({ username: entry.username, status: "not-found" });
			continue;
		}

		if (alreadyApplied.has(user.id)) {
			results.push({
				username: entry.username,
				status: "skipped",
				reason: `already applied for ${month}`,
			});
			continue;
		}

		const grantMb = entry.grantMb * ps.months;
		const beforeMb = user.driveCapacityOverrideMb;
		const afterMb = Math.min(
			(beforeMb ?? DEFAULT_DRIVE_SIZE / MB) + grantMb,
			MAX_DRIVE_SIZE / MB,
		);

		if (!dryRun) {
			// 一意制約 (userId, month) が最後の砦。並行実行時はここで落ちる。
			await UserSupports.insert({
				id: genId(),
				userId: user.id,
				month,
				source: entry.source ?? "ofuse",
				externalId: entry.externalId ?? null,
				plans: entry.plans ?? [],
				grantMb,
				months: ps.months,
				beforeMb,
				afterMb,
				appliedAt,
				appliedById: me.id,
			});

			await Users.update(user.id, {
				driveCapacityOverrideMb: afterMb,
				lastSupportedMonth: month,
			});

			publishInternalEvent("localUserUpdated", { id: user.id });

			// monthlySupporter / patron はパック済みユーザーに載るので、
			// パックのキャッシュも落とさないと反映が遅れる。
			await Users.invalidateMeDetailedBaseCache(user.id);
			await Users.invalidateUserShowDetailedCache(user.id);
		}

		results.push({
			username: entry.username,
			status: "applied",
			beforeMb,
			afterMb,
			grantMb,
			months: ps.months,
		});
	}

	const applied = results.filter((r) => r.status === "applied").length;

	if (!dryRun && applied > 0) {
		await insertModerationLog(me, "grant-support", {
			month,
			months: ps.months,
			applied,
			usernames: results
				.filter((r) => r.status === "applied")
				.map((r) => r.username),
		});
	}

	return {
		month,
		months: ps.months,
		dryRun,
		applied,
		skipped: results.filter((r) => r.status === "skipped").length,
		notFound: results.filter((r) => r.status === "not-found").length,
		results,
	};
});
