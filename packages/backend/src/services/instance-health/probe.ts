/**
 * @packageDocumentation
 *
 * 配送先サーバの生存確認（`/.well-known/nodeinfo` の取得）。
 *
 * @remarks
 * - 一時停止（ブレーカー）からの復帰の確認と、自動停止中のサーバの定期確認（probe-instances）の両方で使う。
 * - 内容に依存しない軽いリクエストで確かめる。本物の配送で確かめると、内容が原因で失敗するジョブを引いたときに
 *   「落ちている」と誤って判断し続けるため。
 * - 相手のアプリが何かしら応答すれば（ステータスは問わない）生きているとみなす（{@link isProbeAlive}）。
 * - 転送（3xx）は追わない。同じサイト内の転送なら生きている、別のサイトへの転送なら生きていないとみなす
 *   （CHANGED 2026-11-22。期限切れのドメインが売買サイトへ転送されるのを「生きている」と数えていた）。
 *
 * @internal
 */
import config from "@/config/index.js";
import { getResponse } from "@/misc/fetch.js";
import { classifyDeliverError, isProbeAlive } from "./classify.js";

/** 確認を打ち切るまでの時間（ミリ秒） */
const PROBE_TIMEOUT_MS = 10 * 1000;

/**
 * 生存確認の結果。
 *
 * @internal
 */
export type ProbeResult = {
	/** 相手のアプリが応答したか */
	alive: boolean;
	/** 確認した URL */
	url: string;
	/** HTTP ステータス（応答が無ければ undefined） */
	statusCode?: number;
	/** 失敗したときの短い説明（例: `ECONNREFUSED`、`521`） */
	label?: string;
};

/**
 * サーバに nodeinfo を取りに行き、生きているかを返す。例外は投げない。
 *
 * @param base - サーバの URL（inbox の URL でもよい）か、ホスト名
 * @returns 確認の結果
 * @internal
 */
export async function probeNodeinfo(base: string): Promise<ProbeResult> {
	const origin = base.includes("://") ? base : `https://${base}`;
	const url = new URL("/.well-known/nodeinfo", origin).toString();

	try {
		const res = await getResponse({
			url,
			method: "GET",
			headers: {
				Accept: "application/json",
				"User-Agent": config.userAgent,
			},
			totalTimeoutMs: PROBE_TIMEOUT_MS,
			size: 64 * 1024,
			// 転送は追わない。別のサイトへの転送（期限切れのドメインなど）を「生きている」と数えないため
			redirect: "manual",
		});
		// 本文を読み切って接続を解放する（中身は使わない）
		await res.arrayBuffer().catch(() => undefined);
		return { alive: true, url, statusCode: res.status };
	} catch (e) {
		const outcome = classifyDeliverError(e, { isSharedInbox: false });
		return {
			alive: isProbeAlive(e),
			url,
			statusCode: outcome.statusCode,
			label: outcome.label,
		};
	}
}
