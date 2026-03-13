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

function apBackoff(attemptsMade: number, err: Error) {
	const baseDelay = 60 * 1000; // 1 分
	const maxBackoff = 8 * 60 * 60 * 1000; // 8 時間
	let backoff = (Math.pow(2, attemptsMade) - 1) * baseDelay;
	backoff = Math.min(backoff, maxBackoff);
	backoff += Math.round(backoff * Math.random() * 0.2);
	return backoff;
}
