/**
 * @packageDocumentation
 *
 * 配送先サーバの状態の変化の履歴（`instance_health_log`）を、新しい順に返す API。
 *
 * @remarks
 * - サーバ情報ページの「履歴」タブ（host を指定）と、ジョブキュー画面の「配送先」タブ（全体）で使う。
 * - できごとの種類で絞り込める。手動操作をした管理者は、ユーザー名だけ返す。
 *
 * @internal
 */
import { In } from "typeorm";
import define from "../../../define.js";
import { InstanceHealthLogs, Users } from "@/models/index.js";
import { toPuny } from "@/misc/convert-host.js";
import { makePaginationQuery } from "../../../common/make-pagination-query.js";

/** 絞り込みに使えるできごとの種類（{@link InstanceHealthEvent} と同じ） */
const events = [
	"circuitOpened",
	"circuitClosed",
	"autoSuspended",
	"gone",
	"unsuspendedByProbe",
	"unsuspendedByInbox",
	"manualSuspended",
	"manualUnsuspended",
	"migrated",
] as const;

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "read:admin:federation",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			properties: {
				id: { type: "string", optional: false, nullable: false, format: "id" },
				createdAt: {
					type: "string",
					optional: false,
					nullable: false,
					format: "date-time",
				},
				host: { type: "string", optional: false, nullable: false },
				event: { type: "string", optional: false, nullable: false },
				fromState: { type: "string", optional: false, nullable: true },
				toState: { type: "string", optional: false, nullable: true },
				source: { type: "string", optional: false, nullable: false },
				reason: { type: "string", optional: false, nullable: true },
				detail: { type: "object", optional: false, nullable: false },
				actor: {
					type: "object",
					optional: false,
					nullable: true,
					properties: {
						id: { type: "string", optional: false, nullable: false },
						username: { type: "string", optional: false, nullable: false },
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		host: { type: "string", nullable: true },
		events: {
			type: "array",
			nullable: true,
			items: { type: "string", enum: events },
		},
		limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
		sinceId: { type: "string", format: "misskey:id" },
		untilId: { type: "string", format: "misskey:id" },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const query = makePaginationQuery(
		InstanceHealthLogs.createQueryBuilder("log"),
		ps.sinceId,
		ps.untilId,
	);
	if (ps.host) query.andWhere("log.host = :host", { host: toPuny(ps.host) });
	if (ps.events && ps.events.length > 0) {
		query.andWhere("log.event IN (:...events)", { events: ps.events });
	}

	const logs = await query.take(ps.limit).getMany();

	// 手動操作をした管理者のユーザー名をまとめて引く
	const actorIds = [
		...new Set(logs.map((l) => l.actorId).filter((x): x is string => x != null)),
	];
	const actors =
		actorIds.length > 0
			? await Users.find({ select: ["id", "username"], where: { id: In(actorIds) } })
			: [];
	const actorMap = new Map(actors.map((a) => [a.id, a]));

	return logs.map((l) => {
		const actor = l.actorId ? actorMap.get(l.actorId) : undefined;
		return {
			id: l.id,
			createdAt: l.createdAt.toISOString(),
			host: l.host,
			event: l.event,
			fromState: l.fromState,
			toState: l.toState,
			source: l.source,
			reason: l.reason,
			detail: l.detail,
			actor: actor ? { id: actor.id, username: actor.username } : null,
		};
	});
});
