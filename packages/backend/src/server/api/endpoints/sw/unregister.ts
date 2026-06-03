/**
 * @packageDocumentation
 *
 * Service Worker のプッシュ購読を解除する API エンドポイント。
 *
 * @remarks
 * NOTE: 認証時は userId で絞り込み。未認証時は endpoint のみ（レガシー互換）。
 *
 * @internal
 */
import { invalidateSwSubscriptionsCache } from "@/misc/sw-subscriptions-cache.js";
import { SwSubscriptions } from "@/models/index.js";
import {
	hashPushEndpoint,
	logPushSubscriptionChange,
} from "@/services/push-audit-log.js";
import define from "../../define.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	description: "プッシュ通知の登録を解除します。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		endpoint: { type: "string", minLength: 1 },
		/** 解除理由（dev ログ用・任意） */
		cause: {
			type: "string",
			enum: ["api-call", "logout", "unknown"],
			default: "api-call",
		},
	},
	required: ["endpoint"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!ps.endpoint?.trim()) return;

	const endpointHash = hashPushEndpoint(ps.endpoint);

	const result = await SwSubscriptions.delete({
		userId: me.id,
		endpoint: ps.endpoint,
	});

	if (result.affected && result.affected > 0) {
		await invalidateSwSubscriptionsCache(me.id);
		const event =
			ps.cause === "logout" ? "unregister-by-logout" : "unregister-by-user";
		void logPushSubscriptionChange(me.id, {
			event,
			cause: ps.cause === "api-call" || ps.cause === "logout" ? "api-call" : "unknown",
			endpointHash,
		});
	}
});
