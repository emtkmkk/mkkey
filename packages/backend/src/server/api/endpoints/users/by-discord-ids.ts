/**
 * @packageDocumentation
 *
 * Discord ID の連携有無をまとめて照会する公開 API。
 *
 * @remarks
 * - **API パス**: `users/by-discord-ids`
 * - 認証不要で、単体または配列の Discord ID を受け取り、連携済み ID のみ返す。
 * - セキュリティ上の理由で、ユーザー ID などの紐づけ情報は返却しない。
 *
 * @see {@link UserProfiles} Discord 連携情報の保存先
 * @public
 */
import { UserProfiles } from "@/models/index.js";
import define from "../../define.js";

const MAX_DISCORD_IDS_PER_REQUEST = 1000;

/**
 * Discord ID の照会 API メタ定義。
 *
 * @internal
 */
export const meta = {
	tags: ["users"],

	requireCredential: false,
	requireCredentialPrivateMode: false,

	limit: {
		key: "users/by-discord-ids",
		duration: 60 * 60 * 1000,
		max: 10,
	},

	description:
		"Discord ID（単体または配列）を受け取り、連携済みの Discord ID のみを配列で返す。",

	res: {
		type: "object",
		optional: false,
		nullable: false,
		properties: {
			registeredDiscordIds: {
				type: "array",
				optional: false,
				nullable: false,
				items: {
					type: "string",
				},
			},
		},
	},
} as const;

/**
 * `users/by-discord-ids` の入力パラメータ定義。
 *
 * @remarks
 * - `discordId` または `discordIds` のどちらかを必須とする。
 * - `discordIds` の最大件数は 1000 件。
 *
 * @internal
 */
export const paramDef = {
	type: "object",
	anyOf: [
		{
			properties: {
				discordId: {
					type: "string",
					minLength: 1,
					description: "照会する Discord ID（単体）。",
				},
			},
			required: ["discordId"],
		},
		{
			properties: {
				discordIds: {
					type: "array",
					minItems: 1,
					maxItems: MAX_DISCORD_IDS_PER_REQUEST,
					items: {
						type: "string",
						minLength: 1,
					},
					description: "照会する Discord ID の配列（最大 1000 件）。",
				},
			},
			required: ["discordIds"],
		},
	],
} as const;

/**
 * Discord ID を正規化して、重複なしの入力順配列を作る。
 *
 * @param ps API入力
 * @returns 重複を取り除いた Discord ID 配列
 *
 * @remarks
 * NOTE: `paramDef` で空文字・空配列は弾かれているため、ここでは重複除去のみ行う。
 *
 * @internal
 */
function normalizeDiscordIds(ps: { discordId?: string; discordIds?: string[] }): string[] {
	// 単体・配列のどちらで来ても同じ処理に揃える。
	const inputIds = ps.discordIds ?? (ps.discordId ? [ps.discordId] : []);
	return [...new Set(inputIds)];
}

export default define(meta, paramDef, async (ps) => {
	const discordIds = normalizeDiscordIds(ps);
	if (discordIds.length === 0) {
		return { registeredDiscordIds: [] };
	}

	const rows = await UserProfiles.createQueryBuilder("profile")
		.select(`profile.integrations->'discord'->>'id'`, "discordId")
		.where(`profile.integrations->'discord'->>'id' IN (:...discordIds)`, {
			discordIds,
		})
		.andWhere("profile.\"userHost\" IS NULL")
		.groupBy(`profile.integrations->'discord'->>'id'`)
		.getRawMany<{ discordId: string | null }>();

	const registeredIdSet = new Set(
		rows.map((row) => row.discordId).filter((id): id is string => typeof id === "string"),
	);

	return {
		// 入力順を維持しつつ、連携済みIDだけ返す（ユーザー紐づけ情報は返さない）。
		registeredDiscordIds: discordIds.filter((id) => registeredIdSet.has(id)),
	};
});
