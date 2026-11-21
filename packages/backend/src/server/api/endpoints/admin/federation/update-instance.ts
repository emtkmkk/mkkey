/**
 * @packageDocumentation
 *
 * 管理者が配送先サーバへの配信を停止・解除する API。
 *
 * @remarks
 * - 停止は「手動停止」として記録し、自動では解除されない。解除はどの停止（手動・自動・閉鎖）からでもできる。
 * - 状態の書き換えと履歴（`instance_health_log`）は {@link setManualSuspension} に任せる。
 *   ここでは、これまでどおりモデレーションログにも残す。
 *
 * @internal
 */
import define from "../../../define.js";
import { Instances } from "@/models/index.js";
import { toPuny } from "@/misc/convert-host.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { setManualSuspension } from "@/services/instance-health/state.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireModerator: true,
	kind: "write:admin:federation",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		host: { type: "string" },
		isSuspended: { type: "boolean" },
		/** 停止・解除の理由（管理者のメモ）。履歴とモデレーションログに残る */
		reason: { type: "string", nullable: true, maxLength: 512 },
	},
	required: ["host", "isSuspended"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const host = toPuny(ps.host);
	const instance = await Instances.findOneBy({ host });

	if (instance == null) {
		throw new Error("instance not found");
	}

	const reason = ps.reason?.trim() || null;
	const previousState = await setManualSuspension(
		host,
		ps.isSuspended,
		me.id,
		reason,
	);
	if (previousState == null) return; // 状態が変わらなかった

	await insertModerationLog(
		me,
		ps.isSuspended ? "suspendInstance" : "unsuspendInstance",
		{ host, previousState, reason },
	);
});
