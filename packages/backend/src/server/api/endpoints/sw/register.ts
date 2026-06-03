/**
 * @packageDocumentation
 *
 * Service Worker のプッシュ購読を登録する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `sw/register`（POST `/api/sw/register` で呼び出し）
 * - 認証必須。endpoint 単位で upsert し、同一 endpoint の古い鍵行は削除する。
 * - sendReadMessage は互換のため受理するが push 既読同期には未使用。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { fetchMeta } from "@/misc/fetch-meta.js";
import { genId } from "@/misc/gen-id.js";
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

	description: "プッシュ通知を受け取るために登録します。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			state: {
				type: "string",
				optional: true,
				nullable: false,
				enum: ["already-subscribed", "subscribed"],
			},
			key: {
				type: "string",
				optional: false,
				nullable: true,
			},
			userId: {
				type: "string",
				optional: true,
				nullable: false,
			},
			endpoint: {
				type: "string",
				optional: false,
				nullable: false,
			},
			sendReadMessage: {
				type: "boolean",
				optional: false,
				nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		endpoint: { type: "string", minLength: 1 },
		auth: { type: "string", minLength: 1 },
		publickey: { type: "string", minLength: 1 },
		sendReadMessage: { type: "boolean", default: false },
		/** 購読変更の理由（dev ログ用・任意） */
		cause: {
			type: "string",
			enum: ["api-call", "pushsubscriptionchange", "unknown"],
			default: "api-call",
		},
	},
	required: ["endpoint", "auth", "publickey"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const instance = await fetchMeta(true);
	const endpointHash = hashPushEndpoint(ps.endpoint);

	// 同一 endpoint で鍵が変わった古い行を削除（endpoint 単位 upsert）
	const staleDelete = await SwSubscriptions.createQueryBuilder()
		.delete()
		.where("userId = :userId", { userId: me.id })
		.andWhere("endpoint = :endpoint", { endpoint: ps.endpoint })
		.andWhere("(auth != :auth OR publickey != :publickey)", {
			auth: ps.auth,
			publickey: ps.publickey,
		})
		.execute();

	if (staleDelete.affected && staleDelete.affected > 0) {
		await invalidateSwSubscriptionsCache(me.id);
	}

	const exist = await SwSubscriptions.findOneBy({
		userId: me.id,
		endpoint: ps.endpoint,
		auth: ps.auth,
		publickey: ps.publickey,
	});

	if (exist != null) {
		return {
			state: "already-subscribed" as const,
			key: instance.swPublicKey,
			userId: me.id,
			endpoint: exist.endpoint,
			sendReadMessage: exist.sendReadMessage,
		};
	}

	await SwSubscriptions.insert({
		id: genId(),
		createdAt: new Date(),
		userId: me.id,
		endpoint: ps.endpoint,
		auth: ps.auth,
		publickey: ps.publickey,
		sendReadMessage: ps.sendReadMessage,
	});

	const cause =
		ps.cause === "pushsubscriptionchange" ? "pushsubscriptionchange" : "api-call";

	await invalidateSwSubscriptionsCache(me.id);

	void logPushSubscriptionChange(me.id, {
		event: "register",
		cause,
		endpointHash,
	});

	return {
		state: "subscribed" as const,
		key: instance.swPublicKey,
		userId: me.id,
		endpoint: ps.endpoint,
		sendReadMessage: ps.sendReadMessage,
	};
});
