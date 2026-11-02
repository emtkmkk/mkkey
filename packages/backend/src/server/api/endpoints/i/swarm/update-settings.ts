import define from "../../../define.js";
import { UserProfiles, Users } from "@/models/index.js";
import type { UserProfile } from "@/models/entities/user-profile.js";
import { publishMainStream } from "@/services/stream.js";

export const meta = {
	tags: ["account"],
	requireCredential: true,
	kind: "write:account",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		showPostFormButton: { type: "boolean", nullable: true },
		insertShareUrl: { type: "boolean", nullable: true },
	},
	required: [],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default define(meta, paramDef, async (ps, me) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: me.id });
	// 型はエンティティの integrations に合わせる（update に渡すときに jsonb の部分更新型と噛み合わせるため）
	const integrations: UserProfile["integrations"] = isRecord(profile.integrations)
		? profile.integrations
		: {};
	// swarm 部分も jsonb の中身なので integrations と同じ型で扱う（update の部分更新型と噛み合わせるため）
	const swarm: UserProfile["integrations"] = isRecord(integrations.swarm)
		? integrations.swarm
		: {};

	if (!swarm.accessToken) {
		return {
			showPostFormButton: false,
			insertShareUrl: true,
		};
	}

	const showPostFormButton = ps.showPostFormButton ?? (swarm.showPostFormButton as boolean | undefined) ?? false;
	const insertShareUrl = ps.insertShareUrl ?? (swarm.insertShareUrl as boolean | undefined) ?? true;

	// NOTE: 先にエンティティの integrations 型として組み立ててから update に渡す。
	// jsonb の中身を直接オブジェクトリテラルで渡すと typeorm の部分更新型（QueryDeepPartialEntity）と噛み合わないため。
	const nextIntegrations: UserProfile["integrations"] = {
		...integrations,
		swarm: {
			...swarm,
			showPostFormButton,
			insertShareUrl,
		},
	};
	await UserProfiles.update(me.id, { integrations: nextIntegrations });

	await Users.invalidateMeDetailedBaseCache(me.id);
	await Users.invalidateUserShowDetailedCache(me.id);
	const packed = await Users.pack(me.id, me, { detail: true, includeSecrets: true });
	publishMainStream(me.id, "meUpdated", packed);
	return {
		showPostFormButton,
		insertShareUrl,
	};
});
