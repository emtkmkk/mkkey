/**
 * @packageDocumentation
 *
 * インスタンスのブロック・サイレンス判定。Meta の blockedHosts / silencedHosts と照合する。
 *
 * @remarks
 * - **役割**: 配信・inbox 処理でブロック/サイレンス対象インスタンスを判定し、スキップに利用する。
 *
 * @see {@link remote/activitypub/deliver-manager} 配信
 * @internal
 */
import { fetchMeta } from "@/misc/fetch-meta.js";
import type { Instance } from "@/models/entities/instance.js";
import type { Meta } from "@/models/entities/meta.js";

/**
 * 指定ホスト（punycode 済み）をブロックすべきかどうかを返す。
 * @param host - インスタンスホスト（punycode）
 * @param meta - 解決済み Meta（省略時は fetchMeta で取得）
 * @returns ブロックすべき場合 true
 * @internal
 */
export async function shouldBlockInstance(
	host: Instance["host"],
	meta?: Meta,
): Promise<boolean> {
	const { blockedHosts } = meta ?? (await fetchMeta());
	return blockedHosts.some(
		(blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`),
	);
}

/**
 * 指定ホスト（punycode 済み）をサイレンスすべきかどうかを返す。
 * @param host - インスタンスホスト（punycode）
 * @param meta - 解決済み Meta（省略時は fetchMeta で取得）
 * @returns サイレンスすべき場合 true
 * @internal
 */
export async function shouldSilenceInstance(
	host: Instance["host"],
	meta?: Meta,
): Promise<boolean> {
	const { silencedHosts } = meta ?? (await fetchMeta());
	return silencedHosts.some(
		(silencedHost) =>
			host === silencedHost || host.endsWith(`.${silencedHost}`),
	);
}
