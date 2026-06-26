/**
 * @packageDocumentation
 *
 * Bull キュー初期化。Redis 接続・レート制限・AP 用バックオフ戦略を設定する。
 *
 * @remarks
 * - **役割**: キュー名とレート制限を指定して Bull インスタンスを生成。deliver・inbox 等のキューで利用する。
 * - 参考: https://github.com/misskey-dev/misskey/pull/7635#issue-971097019
 *
 * @see {@link queue/queues} キュー一覧
 * @internal
 */
import Bull from "bull";
import config from "@/config/index.js";

/**
 * 指定名の Bull キューを生成する。
 * @param name - キュー名
 * @param limitPerSec - 秒あたり最大ジョブ数（0 以下で制限なし）
 * @internal
 */
export function initialize<T>(name: string, limitPerSec = -1) {
	return new Bull<T>(name, {
		redis: {
			port: config.redis.port,
			host: config.redis.host,
			family: config.redis.family == null ? 0 : config.redis.family,
			password: config.redis.pass,
			db: config.redis.db || 0,
		},
		prefix: config.redis.prefix ? `${config.redis.prefix}:queue` : "queue",
		limiter:
			limitPerSec > 0
				? {
						max: limitPerSec,
						duration: 1000,
				  }
				: undefined,
		settings: {
			backoffStrategies: {
				apBackoff,
			},
		},
	});
}

/** apBackoff の base / max を config から解決し、異常値は clamp する。 */
function resolveApBackoffDelays(): { baseDelay: number; maxBackoff: number } {
	const defaultBase = 60 * 1000;
	const defaultMax = 8 * 60 * 60 * 1000;
	const minBase = 1000;
	let baseDelay = config.apBackoffBaseDelayMs ?? defaultBase;
	let maxBackoff = config.apBackoffMaxDelayMs ?? defaultMax;
	if (baseDelay < minBase) baseDelay = minBase;
	if (maxBackoff < baseDelay) maxBackoff = baseDelay;
	return { baseDelay, maxBackoff };
}

/**
 * ActivityPub キュー用の指数バックオフ（失敗後の再試行までの待ち時間）。
 *
 * @param attemptsMade - これまでの試行回数
 * @param _err - 失敗理由（現状は計算に未使用）
 * @returns 待ち時間（ミリ秒）
 * @internal
 */
function apBackoff(attemptsMade: number, _err: Error) {
	const { baseDelay, maxBackoff } = resolveApBackoffDelays();
	let backoff = (Math.pow(2, attemptsMade) - 1) * baseDelay;
	backoff = Math.min(backoff, maxBackoff);
	backoff += Math.round(backoff * Math.random() * 0.2);
	return backoff;
}
