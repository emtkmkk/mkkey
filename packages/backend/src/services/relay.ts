/**
 * @packageDocumentation
 *
 * リレー（フォロー・配信）を扱うサービス。
 *
 * @remarks
 * - **役割**: リレー用のフォロー・Undo の配信や、リレー一覧の取得を行う。Relays と deliver キューを利用する。
 *
 * @see {@link deliver} 配信キュー
 * @internal
 */
import { IsNull } from "typeorm";
import { renderFollowRelay } from "@/remote/activitypub/renderer/follow-relay.js";
import {
	renderActivity,
	attachLdSignature,
} from "@/remote/activitypub/renderer/index.js";
import renderUndo from "@/remote/activitypub/renderer/undo.js";
import { deliver } from "@/queue/index.js";
import type { ILocalUser, User } from "@/models/entities/user.js";
import { Users, Relays } from "@/models/index.js";
import { genId } from "@/misc/gen-id.js";
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_SINGLETON } from "@/misc/cache-limits.js";
import type { Relay } from "@/models/entities/relay.js";
import { createSystemUser } from "./create-system-user.js";

const ACTOR_USERNAME = "relay.actor" as const;

const relaysCache = new Cache<Relay[]>(1000 * 60 * 10, { maxEntries: CACHE_MAX_SINGLETON });

export async function getRelayActor(): Promise<ILocalUser> {
	const user = await Users.findOneBy({
		host: IsNull(),
		username: ACTOR_USERNAME,
	});

	if (user) return user as ILocalUser;

	const created = await createSystemUser(ACTOR_USERNAME);
	return created as ILocalUser;
}

export async function addRelay(inbox: string) {
	const relay = await Relays.insert({
		id: genId(),
		inbox,
		status: "requesting",
	}).then((x) => Relays.findOneByOrFail(x.identifiers[0]));

	const relayActor = await getRelayActor();
	const follow = await renderFollowRelay(relay, relayActor);
	const activity = renderActivity(follow);
	deliver(relayActor, activity, relay.inbox);

	return relay;
}

export async function removeRelay(inbox: string) {
	const relay = await Relays.findOneBy({
		inbox,
	});

	if (relay == null) {
		throw new Error("relay not found");
	}

	const relayActor = await getRelayActor();
	const follow = renderFollowRelay(relay, relayActor);
	const undo = renderUndo(follow, relayActor);
	const activity = renderActivity(undo);
	deliver(relayActor, activity, relay.inbox);

	await Relays.delete(relay.id);
}

export async function listRelay() {
	const relays = await Relays.find();
	return relays;
}

export async function relayAccepted(id: string) {
	const result = await Relays.update(id, {
		status: "accepted",
	});

	return JSON.stringify(result);
}

export async function relayRejected(id: string) {
	const result = await Relays.update(id, {
		status: "rejected",
	});

	return JSON.stringify(result);
}

/**
 * 通常リレーへ署名済み Activity を配送する。
 * @remarks NOTE: 直接配送・通常フォロワーと同じ inbox は除外して二重配送を避ける。
 * @param user - 投稿元のローカルユーザー
 * @param activity - 配送する Activity
 * @param excludedInboxes - 別の配送経路で既に予約した inbox
 * @returns キュー投入完了
 * @internal
 */
export async function deliverToRelays(
	user: { id: User["id"]; host: null },
	activity: any,
	excludedInboxes: ReadonlySet<string> = new Set(),
) {
	if (activity == null) return;

	const relays = await relaysCache.fetch(null, () =>
		Relays.findBy({
			status: "accepted",
		}),
	);
	const targets = relays.filter((relay) => !excludedInboxes.has(relay.inbox));
	if (targets.length === 0) return;

	// TODO
	//const copy = structuredClone(activity);
	const copy = JSON.parse(JSON.stringify(activity));
	if (!copy.to) copy.to = ["https://www.w3.org/ns/activitystreams#Public"];

	const signed = await attachLdSignature(copy, user);

	for (const relay of targets) {
		deliver(user, signed, relay.inbox);
	}
}
