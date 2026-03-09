import { db } from "@/db/postgre.js";
import { Users } from "../index.js";
import { Muting } from "@/models/entities/muting.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { Packed } from "@/misc/schema.js";
import type { User } from "@/models/entities/user.js";
import { In } from "typeorm";

export const MutingRepository = db.getRepository(Muting).extend({
	async pack(
		src: Muting["id"] | Muting,
		me?: { id: User["id"] } | null | undefined,
		options?: { muteePacked?: Packed<"User"> },
	): Promise<Packed<"Muting">> {
		const muting =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		const mutee =
			options?.muteePacked ??
			(await Users.pack(muting.muteeId, me, { detail: true }));

		return await awaitAll({
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			expiresAt: muting.expiresAt ? muting.expiresAt.toISOString() : null,
			muteeId: muting.muteeId,
			mutee,
		});
	},

	async packMany(
		mutings: Muting[],
		me: { id: User["id"] },
	): Promise<Packed<"Muting">[]> {
		if (mutings.length === 0) return [];

		const muteeIds = [...new Set(mutings.map((m) => m.muteeId))];
		const users = await Users.find({
			where: { id: In(muteeIds) },
		});
		const packedUsers = await Users.packMany(users, me, { detail: true });
		const muteePackedMap = new Map(
			users.map((u, i) => [u.id, packedUsers[i]]),
		);

		return Promise.all(
			mutings.map((m) =>
				this.pack(m, me, {
					muteePacked: muteePackedMap.get(m.muteeId),
				}),
			),
		);
	},
});
