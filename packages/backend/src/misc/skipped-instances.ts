/**
 * @packageDocumentation
 *
 * 配信をスキップすべきインスタンスの判定。ブロックと、配信の停止（手動・閉鎖・自動）を考慮する。
 *
 * @remarks
 * - **役割**: 配信ジョブを作る前（deliver-manager）と処理する前（deliver）に、送らない相手を除く。
 * - ブロックは meta、停止中は {@link services/instance-health/suspended-hosts} のメモリキャッシュで判定し、DB は読まない。
 * - CHANGED（2026-11-21）: 以前は DB の `getRawMany()` の結果（`{ host }` のオブジェクト）をホスト名の文字列と混ぜて返していたため、
 *   deliver-manager の `includes(host)` が一致せず、配送前の除外が効いていなかった。
 *
 * @see {@link queue/processors/deliver} 配信キュー
 * @internal
 */
import { fetchMeta } from "@/misc/fetch-meta.js";
import type { Instance } from "@/models/entities/instance.js";
import { getSuspendedHosts } from "@/services/instance-health/suspended-hosts.js";
import { shouldBlockInstance } from "./should-block-instance.js";

/**
 * 配信をスキップすべきホストの一覧を返す。
 * @param hosts - punycode 済みインスタンスホストの配列
 * @returns スキップすべきホストの配列（hosts の部分集合）
 * @internal
 */
export async function skippedInstances(
	hosts: Instance["host"][],
): Promise<Instance["host"][]> {
	const meta = await fetchMeta();
	const suspended = await getSuspendedHosts();
	const blocked = await Promise.all(
		hosts.map((host) => shouldBlockInstance(host, meta)),
	);
	return hosts.filter((host, i) => blocked[i] || suspended.has(host));
}

/**
 * 指定ホスト（punycode 済み）をスキップすべきかどうかを返す。単一ホスト用のラッパー。
 * 複数ホストをまとめて判定する場合は skippedInstances を使う。
 * @param host - インスタンスホスト（punycode）
 * @returns スキップすべき場合 true
 * @internal
 */
export async function shouldSkipInstance(
	host: Instance["host"],
): Promise<boolean> {
	const skipped = await skippedInstances([host]);
	return skipped.length > 0;
}
