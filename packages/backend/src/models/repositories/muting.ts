/**
 * @packageDocumentation
 *
 * 範囲付きユーザーミュートのAPI向けpack処理。
 *
 * @internal
 */
import { db } from "@/db/postgre.js";
import { Users } from "../index.js";
import { Muting } from "@/models/entities/muting.js";
import { awaitAll } from "@/prelude/await-all.js";
import type { Packed } from "@/misc/schema.js";
import type { User } from "@/models/entities/user.js";
import { In } from "typeorm";
import { decodeMuteScope } from "@/misc/mute-scope.js";

export const MutingRepository = db.getRepository(Muting).extend({
	/** 単一のミュート関係を利用者情報と範囲名付きでpackする。 */
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
			muteTypes: decodeMuteScope(muting.scope),
			muteeId: muting.muteeId,
			mutee,
		});
	},

	/** 複数のミュート関係を利用者の一括pack結果で組み立てる。 */
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
