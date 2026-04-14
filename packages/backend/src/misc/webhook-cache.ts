/**
 * @packageDocumentation
 *
 * アクティブ Webhook 一覧のメモリ保持と Redis 内部通知による更新。
 *
 * @remarks
 * - **役割**: 初回 `Webhooks.findBy` の結果を保持。初回のみ **Promise 共有**で並列ミスを防ぐ（`Cache.fetch` ヒットのみでは subscriber の配列差し替えと不整合になり得る）。
 *
 * @see {@link db/redis} subscriber
 * @internal
 */
import { Webhooks } from "@/models/index.js";
import type { Webhook } from "@/models/entities/webhook.js";
import { subscriber } from "@/db/redis.js";

let webhooksFetched = false;
let webhooks: Webhook[] = [];
let webhooksLoadPromise: Promise<void> | null = null;

export async function getActiveWebhooks() {
	if (webhooksFetched) {
		return webhooks;
	}
	if (webhooksLoadPromise) {
		await webhooksLoadPromise;
		return webhooks;
	}
	webhooksLoadPromise = (async () => {
		webhooks = await Webhooks.findBy({
			active: true,
		});
		webhooksFetched = true;
	})().finally(() => {
		webhooksLoadPromise = null;
	});
	await webhooksLoadPromise;
	return webhooks;
}

subscriber.on("message", async (_, data) => {
	const obj = JSON.parse(data);

	if (obj.channel === "internal") {
		const { type, body } = obj.message;
		switch (type) {
			case "webhookCreated":
				if (body.active) {
					webhooks.push(body);
				}
				break;
			case "webhookUpdated":
				if (body.active) {
					const i = webhooks.findIndex((a) => a.id === body.id);
					if (i > -1) {
						webhooks[i] = body;
					} else {
						webhooks.push(body);
					}
				} else {
					webhooks = webhooks.filter((a) => a.id !== body.id);
				}
				break;
			case "webhookDeleted":
				webhooks = webhooks.filter((a) => a.id !== body.id);
				break;
			default:
				break;
		}
	}
});
