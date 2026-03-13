/**
 * @packageDocumentation
 *
 * 配信をスキップすべきインスタンスの判定。ブロック・サスペンド・無応答（dead）を考慮する。
 *
 * @remarks
 * - **役割**: 配信キューで対象ホストを絞り込み、ブロック・dead インスタンスへの送信を避ける。
 *
 * @see {@link queue/processors/deliver} 配信キュー
 * @internal
 */
import { Brackets } from "typeorm";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { Instances } from "@/models/index.js";
import type { Instance } from "@/models/entities/instance.js";
import { DAY } from "@/const.js";
import { shouldBlockInstance } from "./should-block-instance.js";

/** 最終接触からこの日数経過でインスタンスを「無応答」とみなし、配信対象から外す */
const deadThreshold = 7 * DAY;

/**
 * 配信をスキップすべきホストの一覧を返す。
 * @param hosts - punycode 済みインスタンスホストの配列
 * @returns スキップすべきホストの配列（hosts の部分集合）
 * @internal
 */
export async function skippedInstances(
	hosts: Instance["host"][],
): Promise<Instance["host"][]> {
	// ブロック済みはメモリにあるので先に判定
	const meta = await fetchMeta();
	const shouldSkip = await Promise.all(
		hosts.map((host) => shouldBlockInstance(host, meta)),
	);
	const skipped = hosts.filter((_, i) => shouldSkip[i]);

	// 全てスキップなら DB アクセスせずに返す
	if (skipped.length === hosts.length) return hosts;

	const deadTime = new Date(Date.now() - deadThreshold);

	return skipped.concat(
		await Instances.createQueryBuilder("instance")
			.where("instance.host in (:...hosts)", {
				// 既にスキップ済みのホストは再チェックしない（重複も防ぐ）
				hosts: hosts.filter((host) => !skipped.includes(host)),
			})
			.andWhere(
				new Brackets((qb) => {
					qb.where("instance.isSuspended");
				}),
			)
			.select("host")
			.getRawMany(),
	);
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
