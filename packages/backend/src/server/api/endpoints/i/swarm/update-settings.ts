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
		showPostFormButton: { type: "boolean" },
	},
	required: ["showPostFormButton"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const profile = await UserProfiles.findOneByOrFail({ userId: me.id });
	const integrations = profile.integrations ?? {};
	const swarm = integrations.swarm ?? {};

	if (!swarm.accessToken) {
		return {
			showPostFormButton: false,
		};
	}

	await UserProfiles.update(me.id, {
		integrations: {
			...integrations,
			swarm: {
				...swarm,
				showPostFormButton: ps.showPostFormButton,
			},
		},
	});

	const packed = await Users.pack(me, me, { detail: true, includeSecrets: true });
	publishMainStream(me.id, "meUpdated", packed);
	return {
		showPostFormButton: ps.showPostFormButton,
	};
});
