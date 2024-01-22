import { genId } from "@/misc/gen-id.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { FollowBlocking } from "@/models/entities/follow-blocking.js";
import { FollowBlockings } from "@/models/index.js";

export const meta = {
	tags: ["account"],

	requireCredential: true,

	kind: "write:mutes",

	errors: {
		noSuchUser: {
			message: "No such user.",
			code: "NO_SUCH_USER",
			id: "6fef56f3-e765-4957-88e5-c6f65329b8a5",
		},

		alreadyBlocking: {
			message: "You are already blocking that user.",
			code: "ALREADY_BLOCKING",
			id: "7e7359cb-160c-4956-b08f-4d1c653cd007",
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

	// Check if already muting
	const exist = await FollowBlockings.findOneBy({
		blockerId: blocker.id,
		blockeeId: blockee.id,
	});

	if (exist != null) {
		throw new ApiError(meta.errors.alreadyBlocking);
	}

	// Create mute
	await FollowBlockings.insert({
		id: genId(),
		createdAt: new Date(),
		blockerId: blocker.id,
		blockeeId: blockee.id,
	} as FollowBlocking);
});
