import { db } from "@/db/postgre.js";
import { Packed } from "@/misc/schema.js";
import { FollowBlocking } from "@/models/entities/follow-blocking.js";
import { User } from "@/models/entities/user.js";
import { awaitAll } from "@/prelude/await-all.js";
import { Users } from "../index.js";

export const FollowBlockingRepository = db.getRepository(FollowBlocking).extend({
	async pack(
		src: FollowBlocking["id"] | FollowBlocking,
		me?: { id: User["id"] } | null | undefined,
	): Promise<Packed<"FollowBlocking">> {
		const blocking =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll({
			id: blocking.id,
			createdAt: blocking.createdAt.toISOString(),
			blockeeId: blocking.blockeeId,
			blockee: Users.pack(blocking.blockeeId, me, {
				detail: true,
			}),
		});
	},

	packMany(blockings: any[], me: { id: User["id"] }) {
		return Promise.all(blockings.map((x) => this.pack(x, me)));
	},
});
