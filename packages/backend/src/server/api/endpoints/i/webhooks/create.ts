import define from "../../../define.js";
import { genId } from "@/misc/gen-id.js";
import { Webhooks } from "@/models/index.js";
import { publishInternalEvent } from "@/services/stream.js";

export const meta = {
	tags: ["webhooks"],

	requireCredential: true,

	kind: "write:account",

	description:
		"ウェブフックを新規作成する。指定した URL に、選択したイベント（note や follow など）が発生するたびに POST で JSON が送信される。secret で署名検証ができる。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
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
	},
	required: ["name", "url", "secret", "on"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const webhook = await Webhooks.insert({
		id: genId(),
		createdAt: new Date(),
		userId: user.id,
		name: ps.name,
		url: ps.url,
		secret: ps.secret,
		on: ps.on,
	}).then((x) => Webhooks.findOneByOrFail(x.identifiers[0]));

	publishInternalEvent("webhookCreated", webhook);

	return webhook;
});
