/**
 * @packageDocumentation
 *
 * dev モードユーザー向けプッシュ通知監査ログ取得 API。
 *
 * @remarks
 * NOTE: registry client/base/developer が true のユーザーのみ取得可能。
 *
 * @internal
 */
import define from "../../define.js";
import { getPushAuditLogs } from "@/services/push-audit-log.js";

export const meta = {
	tags: ["account"],
	requireCredential: true,
	secure: true,
	description:
		"dev モード（レジストリ developer=true）のユーザー向けに、自身のプッシュ通知ログを返す。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
		since: { type: "integer", minimum: 0, default: 0 },
		kind: {
			type: "string",
			enum: ["send", "subscription", "all"],
			default: "all",
		},
	},
} as const;

export default define(meta, paramDef, async (ps, me) => {
	return await getPushAuditLogs(me.id, {
		limit: ps.limit,
		since: ps.since,
		kind: ps.kind,
	});
});
