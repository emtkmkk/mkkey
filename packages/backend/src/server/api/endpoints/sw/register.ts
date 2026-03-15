/**
 * @packageDocumentation
 *
 * Service Worker のプッシュ購読を登録する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `sw/register`（POST `/api/sw/register` で呼び出し）
 * - 認証必須。endpoint・auth・publicKey などでプッシュ購読情報を登録する。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import { fetchMeta } from "@/misc/fetch-meta.js";
import { genId } from "@/misc/gen-id.js";
import { SwSubscriptions } from "@/models/index.js";
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
		endpoint: { type: "string" },
		auth: { type: "string" },
		publickey: { type: "string" },
		sendReadMessage: { type: "boolean", default: false },
	},
	required: ["endpoint", "auth", "publickey"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// 既に登録済みの場合
	const exist = await SwSubscriptions.findOneBy({
		userId: me.id,
		endpoint: ps.endpoint,
		auth: ps.auth,
		publickey: ps.publickey,
	});

	const instance = await fetchMeta(true);

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

	return {
		state: "subscribed" as const,
		key: instance.swPublicKey,
		userId: me.id,
		endpoint: ps.endpoint,
		sendReadMessage: ps.sendReadMessage,
	};
});
