/**
 * @packageDocumentation
 *
 * インスタンスメタ情報の取得。DB から Meta を読みキャッシュする。定期的に再取得する。
 *
 * @remarks
 * - **役割**: Meta エンティティを 1 件取得。noCache でない限りメモリキャッシュを返す。API・Web・ActivityPub で広く参照される。
 * - **インフライト**: `noCache` でないコールド時に複数呼び出しが重なっても、同一プロセス内では DB トランザクションは 1 本にまとめる。
 * - **クラスタ**: `invalidateMetaCache` は Redis internal イベントで他 worker にも伝播する。
 *
 * @see {@link db/postgre} DB 接続
 * @internal
 */
import { db } from "@/db/postgre.js";
import { subscriber } from "@/db/redis.js";
import { Meta } from "@/models/entities/meta.js";
import Logger from "@/services/logger.js";
import { publishInternalEvent } from "@/services/stream.js";

const logger = new Logger("fetch-meta", "gray");

let cache: Meta;

/** `noCache === false` かつキャッシュ未満のとき、進行中の DB 読み込みを共有する */
let metaLoadInflight: Promise<Meta> | null = null;

/** 定期ポーリング用タイマー */
let metaRefreshTimer: ReturnType<typeof setInterval> | null = null;

/** ポーリング間隔（クラスタ時の VAPID 不整合を抑えるため 5 分より短め） */
const META_REFRESH_INTERVAL_MS = 1000 * 60;

/**
 * プロセス内のメタキャッシュと VAPID 初期化状態をクリアする。
 *
 * @internal
 */
function clearLocalMetaCache(): void {
	cache = undefined as unknown as Meta;
	// NOTE: VAPID は push-notification の ensureVapidDetails が新メタの指紋で再初期化する
}

/**
 * メタキャッシュを無効化し、次回 fetchMeta で DB から再取得する。
 *
 * @remarks
 * NOTE: admin/update-meta 等でメタを更新した直後に呼ぶ。他 worker へは internal イベントで伝播する。
 *
 * @internal
 */
export function invalidateMetaCache(): void {
	clearLocalMetaCache();
	publishInternalEvent("metaCacheInvalidated");
}

function scheduleMetaRefresh(): void {
	if (metaRefreshTimer != null) return;

	metaRefreshTimer = setInterval(() => {
		void fetchMeta(true).catch((err) => {
			logger.warn("定期メタ再取得に失敗しました", err);
		});
	}, META_REFRESH_INTERVAL_MS);
}

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

scheduleMetaRefresh();

subscriber.on("message", (_, data) => {
	try {
		const obj = JSON.parse(data);
		if (obj.channel !== "internal") return;
		if (obj.message?.type !== "metaCacheInvalidated") return;
		clearLocalMetaCache();
	} catch {
		// 他チャンネルのメッセージは無視
	}
});

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
