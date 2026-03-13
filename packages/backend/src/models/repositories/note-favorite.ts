/**
 * @packageDocumentation
 *
 * ノートお気に入りリポジトリ（pack / packMany）
 *
 * @remarks
 * - **役割**: お気に入り一覧の pack を提供し、API のお気に入り取得で利用する。
 *
 * @see {@link models/entities/note-favorite} ノートお気に入りエンティティ
 * @internal
 */
import { db } from "@/db/postgre.js";
import { NoteFavorite } from "@/models/entities/note-favorite.js";
import { Notes } from "../index.js";
import type { User } from "@/models/entities/user.js";

export const NoteFavoriteRepository = db.getRepository(NoteFavorite).extend({
	async pack(
		src: NoteFavorite["id"] | NoteFavorite,
		me?: { id: User["id"] } | null | undefined,
	) {
		const favorite =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		return {
			id: favorite.id,
			createdAt: favorite.createdAt.toISOString(),
			noteId: favorite.noteId,
			// エラーを投げる可能性あり
			note: await Notes.pack(favorite.note || favorite.noteId, me),
		};
	},

	packMany(favorites: any[], me: { id: User["id"] }) {
		return Promise.allSettled(favorites.map((x) => this.pack(x, me))).then(
			(promises) =>
				promises.flatMap((result) =>
					result.status === "fulfilled" ? [result.value] : [],
				),
		);
	},
});
