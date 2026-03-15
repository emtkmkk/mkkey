import define from "../../../define.js";
import { ApiError } from "../../../error.js";
import { Webhooks } from "@/models/index.js";
import { publishInternalEvent } from "@/services/stream.js";

export const meta = {
	tags: ["webhooks"],

	requireCredential: true,

	kind: "write:account",

	description:
		"既存のウェブフックを更新する。名前・URL・secret・送信イベント（on）・有効/無効（active）を変更できる。",

	errors: {
		noSuchWebhook: {
			message: "そのwebhookは存在しません。",
			code: "NO_SUCH_WEBHOOK",
			id: "fb0fea69-da18-45b1-828d-bd4fd1612518",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		webhookId: {
			type: "string",
			format: "misskey:id",
			description: "更新するウェブフックの ID。",
		},
		name: {
			type: "string",
			minLength: 1,
			maxLength: 100,
			description: "ウェブフックの表示名。管理用。",
		},
		url: {
			type: "string",
			minLength: 1,
			maxLength: 1024,
			description: "イベント送信先の URL。POST で JSON が送られる。",
		},
		secret: {
			type: "string",
			minLength: 1,
			maxLength: 1024,
			description:
				"署名検証用の秘密文字列。送信時に X-Misskey-Signature 等で検証できる。",
		},
		on: {
			type: "array",
			items: {
				type: "string",
			},
			description:
				"送信するイベント名の配列。例: ['note', 'follow']。空だと何も送らない。",
		},
		active: {
			type: "boolean",
			description: "true ならイベントを送信する。false なら一時停止。",
		},
	},
	required: ["webhookId", "name", "url", "secret", "on", "active"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const webhook = await Webhooks.findOneBy({
		id: ps.webhookId,
		userId: user.id,
	});

	if (webhook == null) {
		throw new ApiError(meta.errors.noSuchWebhook);
	}

	await Webhooks.update(webhook.id, {
		name: ps.name,
		url: ps.url,
		secret: ps.secret,
		on: ps.on,
		active: ps.active,
	});

	const afterUpdateWebhook = await Webhooks.findOneBy({
		id: ps.webhookId,
		userId: user.id,
	});

	publishInternalEvent("webhookUpdated", afterUpdateWebhook);
});
