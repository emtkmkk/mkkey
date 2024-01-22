import { FollowBlockings } from "@/models/index.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:mutes",

	errors: {
		noSuchUser: {
			message: "No such user.",
			code: "NO_SUCH_USER",
			id: "b851d00b-8ab1-4a56-8b1b-e24187cb48ef",
		},

		notMuting: {
			message: "You are not blocking that user.",
			code: "NOT_BLOCKING",
			id: "5467d020-daa9-4553-81e1-135c0c35a96d",
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: { type: "string", format: "misskey:id" },
	},
	required: ["userId"],
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, paramDef, async (ps, user) => {
	const blocker = user;

	// Get blockee
	const blockee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// Check not muting
	const exist = await FollowBlockings.findOneBy({
		blockerId: blocker.id,
		blockeeId: blockee.id,
	});

	if (exist == null) {
		throw new ApiError(meta.errors.notMuting);
	}

	// Delete mute
	await FollowBlockings.delete({
		id: exist.id,
	});
});
