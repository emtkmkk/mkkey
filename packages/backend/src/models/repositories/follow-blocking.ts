import { db } from "@/db/postgre.js";
import { Packed } from "@/misc/schema.js";
import { FollowBlocking } from "@/models/entities/follow-blocking.js";
import { User } from "@/models/entities/user.js";
import { awaitAll } from "@/prelude/await-all.js";
import { Users } from "../index.js";
import { In } from "typeorm";

export const FollowBlockingRepository = db
	.getRepository(FollowBlocking)
	.extend({
		async pack(
			src: FollowBlocking["id"] | FollowBlocking,
			me?: { id: User["id"] } | null | undefined,
			options?: { blockeePacked?: Packed<"User"> },
		): Promise<Packed<"FollowBlocking">> {
			const blocking =
				typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

			const blockee =
				options?.blockeePacked ??
				(await Users.pack(blocking.blockeeId, me, { detail: true }));

			return await awaitAll({
				id: blocking.id,
				createdAt: blocking.createdAt.toISOString(),
				blockeeId: blocking.blockeeId,
				blockee,
			});
		},

		async packMany(
			blockings: FollowBlocking[],
			me: { id: User["id"] },
		): Promise<Packed<"FollowBlocking">[]> {
			if (blockings.length === 0) return [];

			const blockeeIds = [...new Set(blockings.map((b) => b.blockeeId))];
			const users = await Users.find({
				where: { id: In(blockeeIds) },
			});
			const packedUsers = await Users.packMany(users, me, { detail: true });
			const blockeePackedMap = new Map(
				users.map((u, i) => [u.id, packedUsers[i]]),
			);

			return Promise.all(
				blockings.map((b) =>
					this.pack(b, me, {
						blockeePacked: blockeePackedMap.get(b.blockeeId),
					}),
				),
			);
		},
	});
