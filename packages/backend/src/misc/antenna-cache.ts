/**
 * @packageDocumentation
 *
 * アンテナ一覧のメモリ保持と Redis 内部通知による更新。
 *
 * @remarks
 * - **役割**: 初回 `Antennas.find` の結果をプロセス内で保持する。初回のみ **Promise 共有**で並列ミスを防ぐ（`Cache.fetch` のヒットだけでは subscriber が配列を差し替えるため不整合になり得る）。
 *
 * @see {@link db/redis} subscriber
 * @internal
 */
import { Antennas } from "@/models/index.js";
import type { Antenna } from "@/models/entities/antenna.js";
import { subscriber } from "@/db/redis.js";

let antennasFetched = false;
let antennas: Antenna[] = [];
/** 初回ロードのみ並列をまとめる（配列再代入は subscriber 側のまま） */
let antennasLoadPromise: Promise<void> | null = null;

export async function getAntennas() {
	if (antennasFetched) {
		return antennas;
	}
	if (antennasLoadPromise) {
		await antennasLoadPromise;
		return antennas;
	}
	antennasLoadPromise = (async () => {
		antennas = await Antennas.find();
		antennasFetched = true;
	})().finally(() => {
		antennasLoadPromise = null;
	});
	await antennasLoadPromise;
	return antennas;
}

subscriber.on("message", async (_, data) => {
	const obj = JSON.parse(data);

	if (obj.channel === "internal") {
		const { type, body } = obj.message;
		switch (type) {
			case "antennaCreated":
				antennas.push(body);
				break;
			case "antennaUpdated":
				antennas[antennas.findIndex((a) => a.id === body.id)] = body;
				break;
			case "antennaDeleted":
				antennas = antennas.filter((a) => a.id !== body.id);
				break;
			default:
				break;
		}
	}
});
