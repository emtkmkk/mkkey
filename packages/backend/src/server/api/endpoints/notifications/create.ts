import { IsNull } from "typeorm";
import { createNotification } from "@/services/create-notification.js";
import { Emojis } from "@/models/index.js";
import {
	emojiRegexAtStartToEnd,
	unicodeEmojiRegexAtStartToEnd,
} from "@/misc/emoji-regex.js";
import config from "@/config/index.js";
import define from "../../define.js";

export const meta = {
	tags: ["notifications"],

	requireCredential: true,

	kind: "write:notifications",

	errors: {},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		body: {
			type: "string",
			description: "通知の本文。",
		},
		header: {
			type: "string",
			nullable: true,
			description: "通知のヘッダー（省略時はアプリ名で表示される）。",
		},
		icon: {
			type: "string",
			nullable: true,
			description: "通知のアイコン画像 URL（省略時はアプリアイコンで表示される）。",
		},
		subIcon: {
			type: "string",
			nullable: true,
			description:
				"アイコン右下に表示するサブアイコン。画像 URL（http/https）、Unicode 絵文字、またはカスタム絵文字（`:name:` / リモートは `:name@host:`）を指定できる。カスタム絵文字がサーバに存在しない場合は指定なしと同じ扱いになる。",
		},
	},
	required: ["body"],
} as const;

/**
 * サブアイコンの入力値を正規化する。
 * - 画像 URL（http/https）はそのまま返す
 * - Unicode 絵文字はそのまま返す
 * - カスタム絵文字（`:name:` / `:name@host:`）はサーバに存在すれば正規化した形で返す
 * - それ以外・存在しないカスタム絵文字は null（指定なし扱い）
 */
async function normalizeSubIcon(
	subIcon?: string | null,
): Promise<string | null> {
	if (!subIcon) return null;

	// 画像 URL はそのまま
	if (/^https?:\/\//.test(subIcon)) return subIcon;

	// Unicode 絵文字はそのまま
	if (
		emojiRegexAtStartToEnd.test(subIcon) ||
		unicodeEmojiRegexAtStartToEnd.test(subIcon)
	) {
		return subIcon;
	}

	// カスタム絵文字 :name: または :name@host:
	const match = subIcon.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/);
	if (!match) return null;

	const name = match[1];
	const rawHost = match[2];
	// 自ホスト・"." はローカル扱い
	const host =
		rawHost && rawHost !== "." && rawHost !== config.host ? rawHost : null;

	const emoji = await Emojis.findOneBy({
		name,
		host: host ?? IsNull(),
	});
	if (!emoji) return null;

	return emoji.host ? `:${emoji.name}@${emoji.host}:` : `:${emoji.name}:`;
}

export default define(meta, paramDef, async (ps, user, token) => {
	const customSubIcon = await normalizeSubIcon(ps.subIcon);

	await createNotification(user.id, "app", {
		appAccessTokenId: token ? token.id : null,
		customBody: ps.body,
		customHeader: ps.header,
		customIcon: ps.icon,
		customSubIcon,
	});
});
