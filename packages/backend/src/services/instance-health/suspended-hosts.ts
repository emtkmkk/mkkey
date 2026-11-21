/**
 * @packageDocumentation
 *
 * 配信を停止しているホストの一覧を、プロセスのメモリに持つ。
 *
 * @remarks
 * - **役割**: 配送ジョブを作る前（deliver-manager）と処理する前（deliver）に、停止中かどうかを DB を読まずに判定する。
 *   これまでは配送 1 件ごとに SELECT していた（最適化監査 C-6）。
 * - 初回に全件（数百件程度）を読み込む。変化は内部イベント `instanceSuspensionChanged` で全プロセスに届く。
 *   イベントを取りこぼしても、{@link RELOAD_INTERVAL_MS} ごとに読み直すのでずれ続けない。
 * - 書き換えは {@link ./state.ts} だけが行う（{@link applySuspensionChange}）。
 *
 * @internal
 */
import { Not } from "typeorm";
import { subscriber } from "@/db/redis.js";
import { Instances } from "@/models/index.js";
import type { InstanceSuspensionState } from "@/models/entities/instance.js";

/** 全件を読み直す間隔（ミリ秒）。イベントの取りこぼしへの保険 */
const RELOAD_INTERVAL_MS = 10 * 60 * 1000;

/** 停止中のホスト（punycode） → 状態。null は未読み込み */
let suspended: Map<string, InstanceSuspensionState> | null = null;

/** 最後に全件を読んだ時刻 */
let loadedAt = 0;

/** 読み込み中の Promise（同時に呼ばれても DB を 1 回だけ読む） */
let loading: Promise<Map<string, InstanceSuspensionState>> | null = null;

/**
 * 停止中ホストの一覧を返す。必要なら DB から読み直す。
 *
 * @returns ホスト → 状態
 * @internal
 */
async function load(): Promise<Map<string, InstanceSuspensionState>> {
	if (suspended != null && Date.now() - loadedAt < RELOAD_INTERVAL_MS) {
		return suspended;
	}
	if (loading) return await loading;

	loading = (async () => {
		const rows = await Instances.find({
			select: ["host", "suspensionState"],
			where: { suspensionState: Not("none") },
		});
		const map = new Map<string, InstanceSuspensionState>();
		for (const row of rows) map.set(row.host, row.suspensionState);
		suspended = map;
		loadedAt = Date.now();
		return map;
	})().finally(() => {
		loading = null;
	});
	return await loading;
}

/**
 * ホストが配信を停止中かどうか。
 *
 * @param host - ホスト（punycode）
 * @returns 停止中なら true
 * @internal
 */
export async function isSuspendedHost(host: string): Promise<boolean> {
	return (await load()).has(host);
}

/**
 * 停止中ホストの一覧を返す。
 *
 * @returns ホスト → 状態（呼び出し側で書き換えないこと）
 * @internal
 */
export async function getSuspendedHosts(): Promise<
	ReadonlyMap<string, InstanceSuspensionState>
> {
	return await load();
}

/**
 * このプロセスのキャッシュに、停止状態の変化を反映する。
 *
 * @remarks
 * 他のプロセスへは、呼び出し側（state.ts）が内部イベントで知らせる。そのイベントの受信でもここを通る。
 *
 * @param host - ホスト（punycode）
 * @param state - 新しい状態
 * @internal
 */
export function applySuspensionChange(
	host: string,
	state: InstanceSuspensionState,
): void {
	if (suspended == null) return; // まだ読んでいなければ、次に読むときに反映される
	if (state === "none") suspended.delete(host);
	else suspended.set(host, state);
}

subscriber.on("message", (_, data) => {
	try {
		const obj = JSON.parse(data);
		if (obj.channel !== "internal") return;
		if (obj.message?.type !== "instanceSuspensionChanged") return;
		const body = obj.message.body as {
			host: string;
			suspensionState: InstanceSuspensionState;
		};
		applySuspensionChange(body.host, body.suspensionState);
	} catch {
		// 他チャンネルのメッセージは無視
	}
});
