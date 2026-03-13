/**
 * @packageDocumentation
 *
 * ストリーミング（WebSocket）サーバの初期化。接続受付・認証・MainStreamConnection の生成を行う。
 *
 * @remarks
 * - **役割**: HTTP サーバに WebSocket を張り、`/streaming` 等で接続を受付。認証後に MainStreamConnection を生成する。
 * - クライアントは WebSocket で接続し、チャンネル購読でリアルタイム通知を受信する。
 *
 * @see {@link stream/index} MainStreamConnection
 * @see {@link authenticate} トークン認証
 * @internal
 */
import type * as http from "node:http";
import { EventEmitter } from "events";
import type { ParsedUrlQuery } from "querystring";
import * as websocket from "websocket";

import { subscriber as redisClient } from "@/db/redis.js";
import { Users } from "@/models/index.js";
import MainStreamConnection from "./stream/index.js";
import authenticate from "./authenticate.js";
import { maybeInvalidateDormantFollowerCacheOnActivity } from "@/remote/activitypub/dormant-follower-check.js";

export const initializeStreamingServer = (server: http.Server) => {
	// WebSocket サーバ初期化
	const ws = new websocket.server({
		httpServer: server,
	});

	ws.on("request", async (request) => {
		const q = request.resourceURL.query as ParsedUrlQuery;
		const headers = request.httpRequest.headers["sec-websocket-protocol"] || "";
		const cred = q.i || q.access_token || headers;
		const accessToken = cred.toString();

		const [user, app] = await authenticate(
			request.httpRequest.headers.authorization,
			accessToken,
		).catch((err) => {
			request.reject(403, err.message);
			return [];
		});
		if (typeof user === "undefined") {
			return;
		}

		if (user?.isSuspended) {
			request.reject(400);
			return;
		}

		const connection = request.accept();

		const ev = new EventEmitter();

		async function onRedisMessage(_: string, data: string) {
			const parsed = JSON.parse(data);
			ev.emit(parsed.channel, parsed.message);
		}

		redisClient.on("message", onRedisMessage);
		const host = `https://${request.host}`;
		const prepareStream = q.stream?.toString();
		//console.log("start", q);

		const main = new MainStreamConnection(
			connection,
			ev,
			user,
			app,
			host,
			accessToken,
			prepareStream,
		);

		const intervalId = user
			? setInterval(() => {
					if (user.onlineStatus !== "online") {
						const now = new Date();
						now.setSeconds(now.getSeconds() - 300);
						Users.update(user.id, {
							lastActiveDate: now,
						});
					}
			  }, 1000 * 60 * 2.5)
			: null;
		if (user) {
			const prev = await Users.findOneBy(
				{ id: user.id },
				{ select: ["lastActiveDate", "host"] },
			);
			await maybeInvalidateDormantFollowerCacheOnActivity(
				user.id,
				prev?.host ?? user.host ?? null,
				prev?.lastActiveDate ?? null,
			);
			Users.update(user.id, {
				lastActiveDate: new Date(),
			});
		}

		connection.once("close", () => {
			ev.removeAllListeners();
			main.dispose();
			redisClient.off("message", onRedisMessage);
			if (intervalId) clearInterval(intervalId);
		});

		connection.on("message", async (data) => {
			if (data.type === "utf8" && data.utf8Data === "ping") {
				connection.send("pong");
			}
		});
	});
};
