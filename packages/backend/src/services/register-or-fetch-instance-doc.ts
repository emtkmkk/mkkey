/**
 * @packageDocumentation
 *
 * 連合先インスタンスの DB 行を登録または取得する。
 *
 * @remarks
 * - **役割**: `host` ごとに `Instances` を返す。無ければ insert。`Cache.fetch` で同一ホストのコールド並列を 1 本にまとめる。
 *
 * @internal
 */
import type { Instance } from "@/models/entities/instance.js";
import { Instances } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { toPuny } from "@/misc/convert-host.js";
import { Cache } from "@/misc/cache.js";

const cache = new Cache<Instance>(1000 * 60 * 60);

export async function registerOrFetchInstanceDoc(
	host: string,
): Promise<Instance> {
	host = toPuny(host);

	return await cache.fetch(host, async () => {
		const index = await Instances.findOneBy({ host });

		if (index == null) {
			return await Instances.insert({
				id: genId(),
				host,
				caughtAt: new Date(),
				lastCommunicatedAt: new Date(),
			}).then((x) => Instances.findOneByOrFail(x.identifiers[0]));
		}
		return index;
	});
}
