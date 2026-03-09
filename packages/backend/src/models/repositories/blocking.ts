import { db } from "@/db/postgre.js";
import { Users } from "../index.js";
import { Blocking } from "@/models/entities/blocking.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { Packed } from "@/misc/schema.js";
import type { User } from "@/models/entities/user.js";
import { In } from "typeorm";

export const BlockingRepository = db.getRepository(Blocking).extend({
	async pack(
		src: Blocking["id"] | Blocking,
		me?: { id: User["id"] } | null | undefined,
		options?: { blockeePacked?: Packed<"User"> },
	): Promise<Packed<"Blocking">> {
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
		blockings: Blocking[],
		me: { id: User["id"] },
	): Promise<Packed<"Blocking">[]> {
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
