/**
 * @packageDocumentation
 *
 * モデレーション警告ポップアップを当日分確認したことを記録する API。
 *
 * @remarks
 * クライアントは OK 確定時のみ呼ぶ（背景・Esc では呼ばない）。UTC 日付で当日再表示を抑止する。
 *
 * @internal
 */
import define from "../../define.js";
import { Users } from "@/models/index.js";
import { publishInternalEvent } from "@/services/stream.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:account",
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (_ps, me) => {
	await Users.update(me.id, {
		moderationWarningPopupAt: new Date(),
	});
	await Users.invalidateMeDetailedBaseCache(me.id);
	// 認証キャッシュの `moderationWarningPopupAt` を即時反映し、API / ストリームゲートを解除する
	publishInternalEvent("localUserUpdated", { id: me.id });
	return {};
});
