import define from "../../../define.js";
import { UserProfiles, Users } from "@/models/index.js";
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
	const integrations = isRecord(profile.integrations) ? profile.integrations : {};
	const swarm = isRecord(integrations.swarm) ? integrations.swarm : {};

	if (!swarm.accessToken) {
		return {
			showPostFormButton: false,
			insertShareUrl: true,
		};
	}

	const showPostFormButton = ps.showPostFormButton ?? (swarm.showPostFormButton as boolean | undefined) ?? false;
	const insertShareUrl = ps.insertShareUrl ?? (swarm.insertShareUrl as boolean | undefined) ?? true;

	await UserProfiles.update(me.id, {
		integrations: {
			...integrations,
			swarm: {
				...swarm,
				showPostFormButton,
				insertShareUrl,
			},
		},
	});

	await Users.invalidateMeDetailedBaseCache(me.id);
	await Users.invalidateUserShowDetailedCache(me.id);
	const packed = await Users.pack(me.id, me, { detail: true, includeSecrets: true });
	publishMainStream(me.id, "meUpdated", packed);
	return {
		showPostFormButton,
		insertShareUrl,
	};
});
