/**
 * @packageDocumentation
 *
 * 受信したフォローリクエストから、follow範囲ミュート対象を除いて返す。
 *
 * @internal
 */
import define from "../../../define.js";
import { Not, In } from "typeorm";
import { FollowRequests, Mutings } from "@/models/index.js";
import { hasMuteScope } from "@/misc/mute-scope.js";

export const meta = {
	tags: ["following", "account"],

	requireCredential: true,

	kind: "read:following",

	res: {
		type: "array",
		optional: false,
		nullable: false,
		items: {
			type: "object",
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: "string",
					optional: false,
					nullable: false,
					format: "id",
				},
				follower: {
					type: "object",
					optional: false,
					nullable: false,
					ref: "UserLite",
				},
				followee: {
					type: "object",
					optional: false,
					nullable: false,
					ref: "UserLite",
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const followBlocking = (await Mutings.findBy({ muterId: user.id })).filter(
		(muting) => hasMuteScope(muting.scope, "follow"),
	);

	const reqs = await FollowRequests.findBy({
		followeeId: user.id,
		followerId: Not(In(followBlocking.map((muting) => muting.muteeId))),
	});

	return await Promise.all(reqs.map((req) => FollowRequests.pack(req)));
});
