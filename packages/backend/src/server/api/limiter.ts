/**
 * @packageDocumentation
 *
 * API のレート制限（短期・長期）。Redis ベースの Limiter を利用する。
 *
 * @remarks
 * - **役割**: call から呼ばれ、エンドポイントごとの minInterval / limit に基づきレート制限をかける。超過時は 429 を返す。
 *
 * @see {@link call} エンドポイント実行
 * @see {@link endpoints} メタの limit 定義
 * @internal
 */
import Limiter from "ratelimiter";
import { CacheableLocalUser, User } from "@/models/entities/user.js";
import Logger from "@/services/logger.js";
import { redisClient } from "../../db/redis.js";
import type { IEndpointMeta } from "./endpoints.js";

const logger = new Logger("limiter");

export const limiter = (
	limitation: IEndpointMeta["limit"] & { key: NonNullable<string> },
	actor: string,
) =>
	new Promise<void>((ok, reject) => {
		if (process.env.NODE_ENV === "test") ok();

		const hasShortTermLimit = typeof limitation.minInterval === "number";

		const hasLongTermLimit =
			typeof limitation.duration === "number" &&
			typeof limitation.max === "number";

		if (hasShortTermLimit) {
			min();
		} else if (hasLongTermLimit) {
			max();
		} else {
			ok();
		}

		// 短期制限
		function min(): void {
			const minIntervalLimiter = new Limiter({
				id: `${actor}:${limitation.key}:min`,
				duration: limitation.minInterval,
				max: 1,
				db: redisClient,
			});

			minIntervalLimiter.get((err, info) => {
				if (err) {
					return reject("ERR");
				}

				logger.debug(
					`${actor} ${limitation.key} min remaining: ${info.remaining}`,
				);

				if (info.remaining === 0) {
					reject("BRIEF_REQUEST_INTERVAL");
				} else {
					if (hasLongTermLimit) {
						max();
					} else {
						ok();
					}
				}
			});
		}

		// 長期制限
		function max(): void {
			const limiter = new Limiter({
				id: `${actor}:${limitation.key}`,
				duration: limitation.duration,
				max: limitation.max,
				db: redisClient,
			});

			limiter.get((err, info) => {
				if (err) {
					return reject("ERR");
				}

				logger.debug(
					`${actor} ${limitation.key} max remaining: ${info.remaining}`,
				);

				if (info.remaining === 0) {
					reject("RATE_LIMIT_EXCEEDED");
				} else {
					ok();
				}
			});
		}
	});
