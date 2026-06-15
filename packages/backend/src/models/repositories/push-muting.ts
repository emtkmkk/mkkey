/**
 * @packageDocumentation
 *
 * プッシュ通知ミュートリポジトリ（pack / packMany）。
 *
 * @internal
 */
import { db } from "@/db/postgre.js";
import { Packed } from "@/misc/schema.js";
import { PushMuting } from "@/models/entities/push-muting.js";
import { User } from "@/models/entities/user.js";
import { awaitAll } from "@/prelude/await-all.js";
import { Users } from "../index.js";

export const PushMutingRepository = db.getRepository(PushMuting).extend({
	/**
	 * プッシュ通知ミュートを pack する。
	 *
	 * @param src - ID またはエンティティ
	 * @param me - 閲覧者
	 * @returns pack 済みオブジェクト
	 */
	async pack(
		src: PushMuting["id"] | PushMuting,
		me?: { id: User["id"] } | null | undefined,
	): Promise<Packed<"PushMuting">> {
		const muting =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll({
			id: muting.id,
			createdAt: muting.createdAt.toISOString(),
			muteeId: muting.muteeId,
			mutee: Users.pack(muting.muteeId, me, {
				detail: true,
			}),
		});
	},

	/**
	 * 複数のプッシュ通知ミュートを pack する。
	 *
	 * @param mutings - エンティティ配列
	 * @param me - 閲覧者
	 */
	packMany(mutings: PushMuting[], me: { id: User["id"] }) {
		return Promise.all(mutings.map((x) => this.pack(x, me)));
	},
});
