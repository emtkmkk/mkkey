/**
 * @packageDocumentation
 *
 * 配送がタイムアウトしたときに、相手のサーバへ TCP 接続だけを試して、接続段階で止まっているかを確かめる。
 *
 * @remarks
 * - **役割**: node-fetch のタイムアウト（AbortError）は、接続できずに止まったのか、送った後に返事が来ないのかを区別できない。
 *   前者はサーバ全体の不調（ブレーカーで数える）、後者は内容が原因のこともある（数えない）ので、ここで見分ける。
 * - 本番の調査（2026-11-20）で、タイムアウトが多い opentoot.org などは TCP 接続自体が完了しないと分かっている。
 * - 同じホストへの確認は {@link CHECK_CACHE_MS} の間だけ結果を使い回す。タイムアウトが続いても、確認の接続は増えない。
 * - データは送らず、接続できたらすぐ切る。SSRF の確認は、失敗した本来のリクエストの時点で済んでいる。
 *
 * @internal
 */
import * as net from "node:net";
import config from "@/config/index.js";
import { CACHE_MAX_HOST } from "@/misc/cache-limits.js";

/**
 * 接続確認のタイムアウト（ミリ秒）。
 *
 * @remarks
 * 配送は、ジョブのタイムアウトの 5 秒前に通信を打ち切ってからここに来る（{@link ../../queue/job-timeouts.ts}）。
 * その 5 秒に収まるよう 3 秒にする。普通のサーバは 1 秒かからずに接続できる（本番の実測で 24ms 程度）。
 */
const CONNECT_TIMEOUT_MS = 3 * 1000;

/** 同じホストへの確認結果を使い回す時間（ミリ秒） */
const CHECK_CACHE_MS = 60 * 1000;

/**
 * ホスト（host:port）ごとの確認結果と、確認中の Promise。
 *
 * @remarks
 * 可変。古いものは {@link checkTcpConnect} の中で上限を超えたときに消す。
 *
 * @internal
 */
const results = new Map<string, { ok: boolean; at: number } | Promise<boolean>>();

/**
 * 指定 URL のホストに TCP 接続できるかを確かめる。
 *
 * @param url - 配送先の URL（ホストとポートだけを使う）
 * @returns 接続できれば true
 * @internal
 */
export async function checkTcpConnect(url: string): Promise<boolean> {
	const u = new URL(url);
	const port = Number(u.port) || (u.protocol === "http:" ? 80 : 443);
	const key = `${u.hostname}:${port}`;

	const cached = results.get(key);
	if (cached instanceof Promise) return cached;
	if (cached != null && Date.now() - cached.at < CHECK_CACHE_MS) return cached.ok;

	const promise = connectOnce(u.hostname, port).then((ok) => {
		results.set(key, { ok, at: Date.now() });
		return ok;
	});
	results.set(key, promise);

	// 上限を超えたら古い順に消す（Map は挿入順）
	if (results.size > CACHE_MAX_HOST) {
		const oldest = results.keys().next().value;
		if (oldest != null && oldest !== key) results.delete(oldest);
	}

	return promise;
}

/**
 * TCP 接続を 1 回だけ試す。
 *
 * @param host - ホスト名
 * @param port - ポート
 * @returns 接続できれば true
 * @internal
 */
function connectOnce(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.connect({
			host,
			port,
			localAddress: config.outgoingAddress,
			timeout: CONNECT_TIMEOUT_MS,
		});

		const finish = (ok: boolean) => {
			socket.destroy();
			resolve(ok);
		};

		socket.once("connect", () => finish(true));
		socket.once("timeout", () => finish(false));
		socket.once("error", () => finish(false));
	});
}
