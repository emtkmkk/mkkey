/**
 * @packageDocumentation
 *
 * インスタンスメタ情報の取得。DB から Meta を読みキャッシュする。定期的に再取得する。
 *
 * @remarks
 * - **役割**: Meta エンティティを 1 件取得。noCache でない限りメモリキャッシュを返す。API・Web・ActivityPub で広く参照される。
 *
 * @see {@link db/postgre} DB 接続
 * @internal
 */
import { db } from "@/db/postgre.js";
import { Meta } from "@/models/entities/meta.js";

let cache: Meta;

/**
 * メタ情報を取得する。noCache が true でない限りキャッシュを返す。
 * @param noCache - true のときキャッシュを無視して DB から取得
 * @returns Meta エンティティ
 * @internal
 */
export async function fetchMeta(noCache = false): Promise<Meta> {
	if (!noCache && cache) return cache;

	return await db.transaction(async (transactionalEntityManager) => {
		// 過去のバグにより複数のレコードが作成された可能性があるため、新しいIDが優先されるようにしてい	ます。
		const metas = await transactionalEntityManager.find(Meta, {
			order: {
				id: "DESC",
			},
		});

		const meta = metas[0];

		if (meta) {
			cache = meta;
			return meta;
		} else {
      // meta が空のときにfetchMeta が同時に呼び出された場合、この部分も同時に呼び出される可能性があるため、フェイルセーフ upsert を使用します。
			const saved = await transactionalEntityManager
				.upsert(
					Meta,
					{
						id: "x",
					},
					["id"],
				)
				.then((x) =>
					transactionalEntityManager.findOneByOrFail(Meta, x.identifiers[0]),
				);

			cache = saved;
			return saved;
		}
	});
}

setInterval(() => {
	fetchMeta(true).then((meta) => {
		cache = meta;
	});
}, 1000 * 10);
