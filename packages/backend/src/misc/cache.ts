/**
 * @packageDocumentation
 *
 * メモリキャッシュ。キー・有効期間・fetch による取得を提供する。
 *
 * @remarks
 * - **役割**: インメモリの TTL 付きキャッシュ。get で未ヒット時は fetch を呼び、set で保存する。stats 等で利用。
 * - **インフライト結合**: `fetch` / `fetchMaybe` は同一キーでキャッシュミスが重なったとき `fetcher` を 1 本にまとめる。まず同一プロセス内で結合し、続いて Redis を使ったワーカー横断結合を試みる。
 * - **障害時方針**: 分散ロックで失敗してもフェイルオープンで `fetcher` を実行する（機能を止めない）。
 * - **メモリ上限**: `maxEntries` で LRU 追い出し。失効エントリは `sweepExpired` と定期 sweep で削除する。
 *
 * - **注意**: `fetcher` 内で同一インスタンス・同一キーの `fetch` を再帰的に `await` するとデッドロックし得る（通常の利用では起きにくい）。
 *
 * @internal
 */

import * as crypto from "node:crypto";
import config from "@/config/index.js";
import {
	runDistributedSingleflight,
	type DistributedSingleflightAdapter,
} from "@/misc/distributed-singleflight.js";
import Logger from "@/services/logger.js";

const logger = new Logger("cache");

/** `key === null` を inflight の Map キーに使うときの内部表現（通常の文字列キーと衝突しないようにする） */
const INFLIGHT_KEY_FOR_NULL = "\0__cache_key_null__";

type CacheDistributedOpts = {
	enabled: boolean;
	lockTtlSec: number;
	resultTtlSec: number;
	waitTimeoutMs: number;
	pubsubTimeoutMs: number;
	pollIntervalMs: number;
	pollJitterRatio: number;
	lockExtendIntervalMs: number;
	maxLockExtendCount: number;
};

type CacheMemoryOpts = {
	defaultMaxEntries: number;
	sweepIntervalMs: number;
};

type DistributedMaybeEnvelope<T> =
	| { hasValue: false }
	| { hasValue: true; value: T };

/**
 * `Cache` コンストラクタのオプション。
 *
 * @public
 */
export type CacheOptions<T> = {
	/** 保持するエントリ数の上限（LRU で追い出し）。未指定時は config の既定値。 */
	maxEntries?: number;
	/**
	 * 分散 singleflight のキー接頭辞。
	 *
	 * @remarks
	 * NOTE: 既定の stack 由来 fallback は、ビルド差異や callsite 変化で衝突・変動し得るため、
	 * 取り違えを避けたいキャッシュは明示指定を推奨する。
	 */
	scopeName?: string;
	/** 分散 singleflight 用の値コーデック。 */
	codec?: CacheValueCodec<T>;
};

type CacheValueCodec<T> = {
	/**
	 * 分散 singleflight の結果保存用に値を文字列へ変換する。
	 *
	 * @param value - 変換対象の値
	 * @returns 保存可能な文字列
	 */
	serialize: (value: T) => string;
	/**
	 * 分散 singleflight で受け取った文字列から値を復元する。
	 *
	 * @param raw - 保存されていた文字列
	 * @returns 復元した値
	 */
	deserialize: (raw: string) => T;
};

type EncodedCacheValue =
	| null
	| boolean
	| number
	| string
	| EncodedCacheValue[]
	| { [key: string]: EncodedCacheValue }
	| { __cacheType: "Date"; iso: string }
	| { __cacheType: "Map"; entries: [EncodedCacheValue, EncodedCacheValue][] }
	| { __cacheType: "Set"; values: EncodedCacheValue[] };

type EncodedDateValue = { __cacheType: "Date"; iso: string };
type EncodedMapValue = { __cacheType: "Map"; entries: [EncodedCacheValue, EncodedCacheValue][] };
type EncodedSetValue = { __cacheType: "Set"; values: EncodedCacheValue[] };

//#region エンコード済み値の型ガード
function isEncodedDateValue(value: EncodedCacheValue): value is EncodedDateValue {
	return typeof value === "object" && value !== null && "__cacheType" in value && value.__cacheType === "Date";
}

function isEncodedMapValue(value: EncodedCacheValue): value is EncodedMapValue {
	return typeof value === "object" && value !== null && "__cacheType" in value && value.__cacheType === "Map";
}

function isEncodedSetValue(value: EncodedCacheValue): value is EncodedSetValue {
	return typeof value === "object" && value !== null && "__cacheType" in value && value.__cacheType === "Set";
}
//#endregion

/**
 * 分散 singleflight 向けに `Map` / `Set` を壊さず JSON へ変換する。
 *
 * @remarks
 * NOTE: 既定の `JSON.stringify` では `Map` / `Set` が空オブジェクト相当へ落ちるため、
 * キャッシュ値の構造が崩れて `.has` などで例外になることがある。
 *
 * @param value - 変換対象
 * @returns JSON 互換の中間表現
 * @internal
 */
function encodeCacheValue(value: unknown): EncodedCacheValue {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => encodeCacheValue(item));
	}
	if (value instanceof Map) {
		return {
			__cacheType: "Map",
			entries: Array.from(value.entries()).map(([key, mapValue]) => [
				encodeCacheValue(key),
				encodeCacheValue(mapValue),
			]),
		};
	}
	if (value instanceof Set) {
		return {
			__cacheType: "Set",
			values: Array.from(value.values()).map((item) => encodeCacheValue(item)),
		};
	}
	if (value instanceof Date) {
		return {
			__cacheType: "Date",
			iso: value.toISOString(),
		};
	}
	if (value && typeof value === "object") {
		const source = value as Record<string, unknown>;
		const encodedObject: Record<string, EncodedCacheValue> = {};
		for (const [key, objectValue] of Object.entries(source)) {
			encodedObject[key] = encodeCacheValue(objectValue);
		}
		return encodedObject;
	}
	return null;
}

/**
 * `encodeCacheValue` で作成した中間表現を元の構造へ戻す。
 *
 * @param value - 復元対象
 * @returns 復元後の値
 * @internal
 */
function decodeCacheValue(value: EncodedCacheValue): unknown {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => decodeCacheValue(item));
	}
	if (isEncodedMapValue(value)) {
		return new Map(
			value.entries.map(([encodedKey, encodedValue]) => [
				decodeCacheValue(encodedKey),
				decodeCacheValue(encodedValue),
			]),
		);
	}
	if (isEncodedSetValue(value)) {
		return new Set(value.values.map((item) => decodeCacheValue(item)));
	}
	if (isEncodedDateValue(value)) {
		return new Date(value.iso);
	}
	const decodedObject: Record<string, unknown> = {};
	for (const [key, objectValue] of Object.entries(value)) {
		decodedObject[key] = decodeCacheValue(objectValue as EncodedCacheValue);
	}
	return decodedObject;
}

function getCacheDistributedOpts(): CacheDistributedOpts {
	const distributedConfig = config.cache?.distributedInflight;
	const lockTtlSecRaw = Number(distributedConfig?.lockTtlSec ?? "");
	const resultTtlSecRaw = Number(distributedConfig?.resultTtlSec ?? "");
	const waitTimeoutMsRaw = Number(distributedConfig?.waitTimeoutMs ?? "");
	const pubsubTimeoutMsRaw = Number(distributedConfig?.pubsubTimeoutMs ?? "");
	const pollIntervalMsRaw = Number(distributedConfig?.pollIntervalMs ?? "");
	const pollJitterRatioRaw = Number(distributedConfig?.pollJitterRatio ?? "");
	const lockExtendIntervalMsRaw = Number(distributedConfig?.lockExtendIntervalMs ?? "");
	const maxLockExtendCountRaw = Number(distributedConfig?.maxLockExtendCount ?? "");

	return {
		enabled: distributedConfig?.enabled !== false,
		lockTtlSec: Number.isFinite(lockTtlSecRaw) && lockTtlSecRaw > 0 ? lockTtlSecRaw : 15,
		resultTtlSec:
			Number.isFinite(resultTtlSecRaw) && resultTtlSecRaw > 0 ? resultTtlSecRaw : 20,
		waitTimeoutMs:
			Number.isFinite(waitTimeoutMsRaw) && waitTimeoutMsRaw > 0 ? waitTimeoutMsRaw : 8000,
		pubsubTimeoutMs:
			Number.isFinite(pubsubTimeoutMsRaw) && pubsubTimeoutMsRaw > 0 ? pubsubTimeoutMsRaw : 1200,
		pollIntervalMs:
			Number.isFinite(pollIntervalMsRaw) && pollIntervalMsRaw > 0 ? pollIntervalMsRaw : 150,
		pollJitterRatio:
			Number.isFinite(pollJitterRatioRaw) && pollJitterRatioRaw >= 0
				? pollJitterRatioRaw
				: 0.2,
		lockExtendIntervalMs:
			Number.isFinite(lockExtendIntervalMsRaw) && lockExtendIntervalMsRaw >= 0
				? lockExtendIntervalMsRaw
				: 5000,
		maxLockExtendCount:
			Number.isFinite(maxLockExtendCountRaw) && maxLockExtendCountRaw >= 0
				? maxLockExtendCountRaw
				: 2,
	};
}

/** 定期 sweep 対象として登録された `Cache` インスタンス */
const registeredCaches = new Set<Cache<unknown>>();
let globalSweepTimerStarted = false;

/**
 * `config.cache.memory` を正規化して返す。
 *
 * @returns 件数上限・sweep 間隔の既定値込みの設定
 * @internal
 */
function getCacheMemoryOpts(): CacheMemoryOpts {
	const memoryConfig = config.cache?.memory;
	const defaultMaxEntriesRaw = Number(memoryConfig?.defaultMaxEntries ?? "");
	const sweepIntervalMsRaw = Number(memoryConfig?.sweepIntervalMs ?? "");

	return {
		defaultMaxEntries:
			Number.isFinite(defaultMaxEntriesRaw) && defaultMaxEntriesRaw > 0
				? defaultMaxEntriesRaw
				: 10_000,
		sweepIntervalMs: Number.isFinite(sweepIntervalMsRaw) ? sweepIntervalMsRaw : 60_000,
	};
}

/**
 * コンストラクタ引数または config から件数上限を決める。
 *
 * @param maxEntries - 呼び出し側が指定した上限
 * @returns 正の整数の上限
 * @internal
 */
function resolveMaxEntries(maxEntries?: number): number {
	if (maxEntries != null && Number.isFinite(maxEntries) && maxEntries > 0) {
		return maxEntries;
	}
	return getCacheMemoryOpts().defaultMaxEntries;
}

/**
 * 全登録 `Cache` に対する定期 sweep タイマーを 1 本だけ起動する。
 *
 * @remarks
 * NOTE: `sweepIntervalMs <= 0` のときは tick 内で何もしない（テスト無効化用）。
 * @internal
 */
function startGlobalSweepTimerIfNeeded(): void {
	if (globalSweepTimerStarted) return;
	globalSweepTimerStarted = true;

	const { sweepIntervalMs } = getCacheMemoryOpts();
	if (sweepIntervalMs <= 0) return;

	setInterval(() => {
		if (getCacheMemoryOpts().sweepIntervalMs <= 0) return;
		for (const cache of registeredCaches) {
			cache.sweepExpired();
		}
	}, sweepIntervalMs);
}

let cacheDistributedAdapterOverride: DistributedSingleflightAdapter | null = null;
let cacheDistributedAdapterPromise: Promise<DistributedSingleflightAdapter> | null = null;

async function getDefaultCacheDistributedAdapter(): Promise<DistributedSingleflightAdapter> {
	if (!cacheDistributedAdapterPromise) {
		cacheDistributedAdapterPromise = import("@/misc/distributed-singleflight-redis.js").then((m) =>
			m.createRedisDistributedSingleflightAdapter("cacheInflight:v1"),
		);
	}
	return await cacheDistributedAdapterPromise;
}

/**
 * テスト用に分散アダプターを差し替える。
 *
 * @param adapter - 差し替え先（`null` で既定に戻す）
 * @internal
 */
export function setCacheDistributedAdapterForTests(
	adapter: DistributedSingleflightAdapter | null,
): void {
	cacheDistributedAdapterOverride = adapter;
}

export class Cache<T> {
	public cache: Map<string | null, { date: number; value: T }>;
	private lifetime: number;
	private maxEntries: number;
	private scopeName: string;
	private codec: CacheValueCodec<T>;

	/**
	 * 同一キーで進行中の `fetch` / `fetchMaybe` を区別してまとめる。
	 *
	 * @remarks
	 * `fetch` と `fetchMaybe` は別 Promise として保持する（同一キーへ混在呼び出し時の意味を分離するため）。
	 */
	private inflightByOp = new Map<string, Promise<unknown>>();

	/**
	 * @param lifetime - エントリの TTL（ミリ秒）。`Infinity` で期限なし。
	 * @param options - 件数上限・コーデックなどのオプション
	 */
	constructor(lifetime: number, options?: CacheOptions<T>) {
		this.cache = new Map();
		this.lifetime = lifetime;
		this.maxEntries = resolveMaxEntries(options?.maxEntries);
		this.scopeName = options?.scopeName ?? this.deriveDefaultScopeName();
		this.codec = options?.codec ?? {
			serialize: (value) => JSON.stringify(encodeCacheValue(value)),
			deserialize: (raw) => decodeCacheValue(JSON.parse(raw) as EncodedCacheValue) as T,
		};
		registeredCaches.add(this as Cache<unknown>);
		startGlobalSweepTimerIfNeeded();
	}

	/** 現在保持しているエントリ数 */
	public get size(): number {
		return this.cache.size;
	}

	/**
	 * エントリが TTL 失効済みかどうか。
	 *
	 * @param entry - 判定対象
	 * @returns 失効していれば true
	 * @internal
	 */
	private isEntryExpired(entry: { date: number; value: T }): boolean {
		return Number.isFinite(this.lifetime) && Date.now() - entry.date > this.lifetime;
	}

	/**
	 * LRU 順序を更新する（参照されたキーを末尾へ移動）。
	 *
	 * @param key - 対象キー
	 * @param entry - エントリ本体
	 * @internal
	 */
	private touchKey(key: string | null, entry: { date: number; value: T }): void {
		this.cache.delete(key);
		this.cache.set(key, entry);
	}

	/**
	 * 件数上限を超えた分を LRU 順（Map 先頭）から追い出す。
	 *
	 * @internal
	 */
	private evictOverflow(): void {
		while (this.cache.size > this.maxEntries) {
			const oldestKey = this.cache.keys().next().value as string | null | undefined;
			if (oldestKey === undefined) break;
			this.cache.delete(oldestKey);
		}
	}

	/**
	 * TTL 失効済みエントリを一括削除する。
	 *
	 * @returns 削除した件数
	 * @remarks
	 * NOTE: 再アクセスされない失効キーのメモリ解放用。有効エントリの LRU 順序は変えない。
	 */
	public sweepExpired(): number {
		if (!Number.isFinite(this.lifetime)) return 0;

		const now = Date.now();
		let removed = 0;
		for (const [key, entry] of this.cache) {
			if (now - entry.date > this.lifetime) {
				this.cache.delete(key);
				removed += 1;
			}
		}
		return removed;
	}

	/**
	 * inflight Map 用のキー（null 正規化 + 操作種別）。
	 *
	 * @param op - `fetch` と `fetchMaybe` のどちらの待ち行列か
	 * @param key - キャッシュキー（`null` は内部定数に正規化）
	 * @returns `inflightByOp` 用の一意キー
	 * @internal
	 */
	private inflightCompositeKey(op: "fetch" | "fetchMaybe", key: string | null): string {
		const base = key === null ? INFLIGHT_KEY_FOR_NULL : key;
		return `${op}\0${base}`;
	}

	/**
	 * ワーカー横断 singleflight 用の分散キーを作る。
	 *
	 * @param op - 操作種別
	 * @param key - 呼び出しキー
	 * @returns 分散ロック用キー
	 * @internal
	 */
	private distributedKey(op: "fetch" | "fetchMaybe", key: string | null): string {
		const base = key === null ? INFLIGHT_KEY_FOR_NULL : key;
		return `${this.scopeName}\0${op}\0${base}`;
	}

	/**
	 * `scopeName` 未指定時の fallback 値を生成する。
	 *
	 * @remarks
	 * NOTE: 既存運用との互換維持のため stack ベースを残している。
	 * scope 衝突回避が必要な箇所では `CacheOptions.scopeName` を明示すること。
	 *
	 * @returns 既定 scope 名
	 * @internal
	 */
	private deriveDefaultScopeName(): string {
		// 既存実装と互換な stack 行ハッシュを使う（段階移行のため）。
		const callsite = new Error().stack?.split("\n")[2]?.trim() ?? "unknown";
		return crypto.createHash("sha256").update(callsite, "utf8").digest("hex").slice(0, 16);
	}

	/**
	 * `fetchMaybe` 用に `undefined` を壊さず直列化する。
	 *
	 * @remarks
	 * NOTE: `JSON.stringify(undefined)` は JSON 文字列ではないため、そのまま保存すると follower 側の `JSON.parse` が失敗する。
	 *
	 * @param value - `fetchMaybe` の結果
	 * @returns JSON 文字列
	 * @internal
	 */
	private serializeDistributedMaybe(value: T | undefined): string {
		const envelope: DistributedMaybeEnvelope<T> =
			value === undefined ? { hasValue: false } : { hasValue: true, value };
		if (envelope.hasValue) {
			return JSON.stringify({
				hasValue: true as const,
				value: this.codec.serialize(envelope.value),
			});
		}
		return JSON.stringify(envelope);
	}

	/**
	 * `fetchMaybe` 用の分散ペイロードを復元する。
	 *
	 * @param raw - `serializeDistributedMaybe` で作成した JSON
	 * @returns 元の値（`undefined` を含む）
	 * @internal
	 */
	private deserializeDistributedMaybe(raw: string): T | undefined {
		const parsed = JSON.parse(raw) as
			| Partial<DistributedMaybeEnvelope<T>>
			| { hasValue: true; value: string };
		if (parsed.hasValue === true) {
			if (typeof parsed.value === "string") {
				return this.codec.deserialize(parsed.value);
			}
			return parsed.value as T;
		}
		return undefined;
	}

	/**
	 * 分散 singleflight（有効時）を試し、失敗時は必要な場合のみローカル `factory` へフォールバックする。
	 *
	 * @remarks
	 * NOTE: `runDistributedSingleflight` 内で leader がすでに `factory` を実行した後に `serialize` 等で失敗した場合、ここで `factory` を再実行しない（重複副作用を避ける）。
	 *
	 * @param op - 呼び出し種別（ログ識別用）
	 * @param key - キャッシュキー
	 * @param factory - 実処理
	 * @param serialize - 分散保存用シリアライザ
	 * @param deserialize - 分散復元用デシリアライザ
	 * @returns `factory` の結果
	 * @internal
	 */
	private async runWithDistributedInflight<V>(
		op: "fetch" | "fetchMaybe",
		key: string | null,
		factory: () => Promise<V>,
		serialize: (value: V) => string,
		deserialize: (raw: string) => V,
	): Promise<V> {
		const opts = getCacheDistributedOpts();
		if (!opts.enabled) {
			return await factory();
		}

		let factoryExecutedInsideDistributed = false;
		const trackedFactory = async (): Promise<V> => {
			factoryExecutedInsideDistributed = true;
			return await factory();
		};

		try {
			return await runDistributedSingleflight<V>({
				scope: "cache",
				key: this.distributedKey(op, key),
				adapter: cacheDistributedAdapterOverride ?? (await getDefaultCacheDistributedAdapter()),
				factory: trackedFactory,
				serialize,
				deserialize,
				lockTtlSec: opts.lockTtlSec,
				resultTtlSec: opts.resultTtlSec,
				waitTimeoutMs: opts.waitTimeoutMs,
				pubsubTimeoutMs: opts.pubsubTimeoutMs,
				pollIntervalMs: opts.pollIntervalMs,
				pollJitterRatio: opts.pollJitterRatio,
				lockExtendIntervalMs: opts.lockExtendIntervalMs,
				maxLockExtendCount: opts.maxLockExtendCount,
				onDebug: (message) => {
					logger.debug(message);
				},
			});
		} catch (e) {
			logger.debug(`cache distributed ${op} fallback key=${String(key)}: ${e}`);
			if (factoryExecutedInsideDistributed) {
				throw e;
			}
			return await factory();
		}
	}

	public set(key: string | null, value: T): void {
		// 既存キーは delete してから set し、挿入順序（LRU）を末尾へ寄せる
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}
		this.cache.set(key, {
			date: Date.now(),
			value,
		});
		this.evictOverflow();
	}

	public get(key: string | null): T | undefined {
		const cached = this.cache.get(key);
		if (cached == null) return undefined;
		if (this.isEntryExpired(cached)) {
			this.cache.delete(key);
			return undefined;
		}
		// ヒット時に LRU 順序を更新する
		this.touchKey(key, cached);
		return cached.value;
	}

	public delete(key: string | null) {
		this.cache.delete(key);
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 *
	 * @remarks
	 * キャッシュミスが同一キーで同時に起きた場合、`fetcher` は 1 回だけ実行され、戻り値は共有される。
	 *
	 * @param key - キャッシュキー
	 * @param fetcher - ミス時に 1 本だけ実行される取得処理
	 * @param validator - 省略可。キャッシュ値がこの関数で true のときだけヒット扱い
	 * @returns キャッシュ値または `fetcher` の結果
	 */
	public async fetch(
		key: string | null,
		fetcher: () => Promise<T>,
		validator?: (cachedValue: T) => boolean,
	): Promise<T> {
		const cachedValue = this.get(key);
		if (cachedValue !== undefined) {
			if (validator) {
				if (validator(cachedValue)) {
					return cachedValue;
				}
			} else {
				return cachedValue;
			}
		}

		const ik = this.inflightCompositeKey("fetch", key);
		const existing = this.inflightByOp.get(ik) as Promise<T> | undefined;
		if (existing !== undefined) {
			return await existing;
		}

		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: unknown) => void;
		const pending = new Promise<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		this.inflightByOp.set(ik, pending);

		void (async () => {
			try {
				const value = await this.runWithDistributedInflight<T>(
					"fetch",
					key,
					fetcher,
					(v) => this.codec.serialize(v),
					(raw) => this.codec.deserialize(raw),
				);
				this.set(key, value);
				resolve(value);
			} catch (e) {
				reject(e);
			} finally {
				this.inflightByOp.delete(ik);
			}
		})();

		return await pending;
	}

	/**
	 * キャッシュがあればそれを返し、無ければfetcherを呼び出して結果をキャッシュ&返します
	 * optional: キャッシュが存在してもvalidatorでfalseを返すとキャッシュ無効扱いにします
	 *
	 * @remarks
	 * `fetch` と同様、同一キーでキャッシュミスが重なったとき `fetcher` は 1 本にまとめる。戻りが `undefined` のときはキャッシュに載せない（従来どおり）。
	 *
	 * @param key - キャッシュキー
	 * @param fetcher - ミス時に 1 本だけ実行される取得処理
	 * @param validator - 省略可。キャッシュ値がこの関数で true のときだけヒット扱い
	 * @returns キャッシュ値、`fetcher` の結果、または `undefined`
	 */
	public async fetchMaybe(
		key: string | null,
		fetcher: () => Promise<T | undefined>,
		validator?: (cachedValue: T) => boolean,
	): Promise<T | undefined> {
		const cachedValue = this.get(key);
		if (cachedValue !== undefined) {
			if (validator) {
				if (validator(cachedValue)) {
					return cachedValue;
				}
			} else {
				return cachedValue;
			}
		}

		const ik = this.inflightCompositeKey("fetchMaybe", key);
		const existing = this.inflightByOp.get(ik) as Promise<T | undefined> | undefined;
		if (existing !== undefined) {
			return await existing;
		}

		let resolve!: (value: T | undefined | PromiseLike<T | undefined>) => void;
		let reject!: (reason?: unknown) => void;
		const pending = new Promise<T | undefined>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		this.inflightByOp.set(ik, pending);

		void (async () => {
			try {
				const value = await this.runWithDistributedInflight<T | undefined>(
					"fetchMaybe",
					key,
					fetcher,
					(v) => this.serializeDistributedMaybe(v),
					(raw) => this.deserializeDistributedMaybe(raw),
				);
				if (value !== undefined) {
					this.set(key, value);
				}
				resolve(value);
			} catch (e) {
				reject(e);
			} finally {
				this.inflightByOp.delete(ik);
			}
		})();

		return await pending;
	}
}
