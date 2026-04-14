/**
 * @packageDocumentation
 *
 * インスタンスメタ情報の取得。DB から Meta を読みキャッシュする。定期的に再取得する。
 *
 * @remarks
 * - **役割**: Meta エンティティを 1 件取得。noCache でない限りメモリキャッシュを返す。API・Web・ActivityPub で広く参照される。
 * - **インフライト**: `noCache` でないコールド時に複数呼び出しが重なっても、同一プロセス内では DB トランザクションは 1 本にまとめる。
 *
 * @see {@link db/postgre} DB 接続
 * @internal
 */
import { db } from "@/db/postgre.js";
import { Meta } from "@/models/entities/meta.js";

let cache: Meta;

/** `noCache === false` かつキャッシュ未満のとき、進行中の DB 読み込みを共有する */
let metaLoadInflight: Promise<Meta> | null = null;

async function loadMetaFromDb(): Promise<Meta> {
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
		}
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
	});
}

/**
 * メタ情報を取得する。noCache が true でない限りキャッシュを返す。
 * @param noCache - true のときキャッシュを無視して DB から取得
 * @returns Meta エンティティ
 * @internal
 */
export async function fetchMeta(noCache = false): Promise<Meta> {
	if (!noCache && cache) return cache;

	if (noCache) {
		return await loadMetaFromDb();
	}

	if (metaLoadInflight) {
		return await metaLoadInflight;
	}

	metaLoadInflight = loadMetaFromDb().finally(() => {
		metaLoadInflight = null;
	});
	return await metaLoadInflight;
}

setInterval(() => {
	fetchMeta(true).then((meta) => {
		cache = meta;
	});
}, 1000 * 10);
