/**
 * ローカル範囲を共有する相手への、購読式の直接リレー。
 * @remarks
 * NOTE: 既存 inbox の署名検証後に Follow(Public) を受け付ける。ローカルの public/home だけを配り、
 * 受信したリモート投稿は再送しない。localOnly の public/home は、この許可済みの相手だけに送る。
 * @packageDocumentation
 * @internal
 */
import config from "@/config/index.js";
import { LocalRelaySubscribers } from "@/models/index.js";
import type { CacheableRemoteUser, IRemoteUser } from "@/models/entities/user.js";
import type { Note } from "@/models/entities/note.js";
import { getApId } from "@/remote/activitypub/type.js";
import type { IFollow } from "@/remote/activitypub/type.js";
import renderAccept from "@/remote/activitypub/renderer/accept.js";
import { renderActivity } from "@/remote/activitypub/renderer/index.js";
import { deliver } from "@/queue/index.js";
import { getRelayActor } from "./relay.js";

/**
 * 許可した actor と同じ HTTPS ホスト上にある配送先だけを返す。
 * @remarks NOTE: 購読者が別ホストの inbox を指定して投稿を持ち出すことを防ぐ。
 * @param actor - 署名検証済みの購読者
 * @returns inbox 情報。許可対象外・停止済みなら null
 * @internal
 */
function subscriberInbox(actor: Pick<IRemoteUser, "host" | "inbox" | "sharedInbox" | "isSuspended" | "isDeleted">) {
	if (actor.isSuspended || actor.isDeleted || !Array.isArray(config.localRelayHosts) || !config.localRelayHosts.includes(actor.host)) return null;
	try {
		if (!actor.inbox || new URL(actor.inbox).protocol !== "https:" || new URL(actor.inbox).host !== actor.host) return null;
		const target = actor.sharedInbox ?? actor.inbox;
		if (!target) return null;
		const url = new URL(target);
		if (url.protocol !== "https:" || url.host !== actor.host || url.username || url.password || url.hash) return null;
		return { url: url.href, shared: actor.sharedInbox != null };
	} catch { return null; }
}

/**
 * リレー購読または解除を処理する。
 * @remarks NOTE: 通常のフォローは null を返して既存処理へ渡す。解除は元の Follow ID と一致する行だけを削除する。
 * @param actor - 署名検証済みのリモート actor
 * @param activity - Follow(Public)
 * @param undo - true は購読解除
 * @returns 処理結果。通常のフォローは null
 * @internal
 */
export async function localRelayFollow(actor: CacheableRemoteUser, activity: IFollow, undo = false): Promise<string | null> {
	if (getApId(activity.object) !== "https://www.w3.org/ns/activitystreams#Public") return null;
	if (getApId(activity.actor) !== actor.uri || typeof activity.id !== "string" || activity.id.length > 2048) return "skip: invalid relay follow";
	try {
		if (new URL(activity.id).origin !== new URL(actor.uri).origin) return "skip: invalid relay follow id";
	} catch { return "skip: invalid relay follow id"; }
	if (undo) {
		await LocalRelaySubscribers.delete({ userId: actor.id, followId: activity.id });
		return "ok: local relay unsubscribed";
	}
	if (!subscriberInbox(actor)) return "skip: local relay host not permitted";
	const relayActor = await getRelayActor();
	await LocalRelaySubscribers.upsert({ userId: actor.id, followId: activity.id }, ["userId"]);
	await deliver(relayActor, renderActivity(renderAccept(activity, relayActor)), actor.inbox, false);
	return "ok: local relay subscribed";
}

/**
 * ローカルの public/home 投稿を直接受け取る、購読済みの inbox を返す。
 * @remarks NOTE: フォロワー限定・指定・hidden とローカル限定チャンネルは追加配送しない。
 * @param note - 配送対象ノート。リモート投稿なら空集合
 * @returns 重複を除いた配送先
 * @internal
 */
export async function getLocalRelayInboxes(note: Pick<Note, "userHost" | "visibility" | "localOnly" | "channelId">): Promise<Map<string, boolean>> {
	const inboxes = new Map<string, boolean>();
	if (!config.localRelayHosts?.length || note.userHost != null || (note.localOnly && note.channelId) || !["public", "home"].includes(note.visibility)) return inboxes;
	const subscribers = await LocalRelaySubscribers.find({ relations: ["user"] });
	for (const subscriber of subscribers) {
		if (!subscriber.user || subscriber.user.host == null) continue;
		const inbox = subscriberInbox(subscriber.user as IRemoteUser);
		if (inbox) inboxes.set(inbox.url, inbox.shared);
	}
	return inboxes;
}

/**
 * 制限された引用・リノートを共有できる相手だけに配送先を絞る。
 * @remarks NOTE: 自サーバーの公開・ホームはローカル相手全体へ、受信した投稿は元サーバーにだけ返す。
 * @param note - 新しいローカル投稿
 * @param reference - 参照元ノート
 * @returns 限定投稿・チャンネル限定を除いた配送先
 * @internal
 */
export async function getLocalRelayReferenceInboxes(note: Pick<Note, "userHost" | "visibility" | "localOnly" | "channelId">, reference: Pick<Note, "userHost" | "visibility" | "localOnly" | "channelId">): Promise<Map<string, boolean>> {
	if (!["public", "home"].includes(reference.visibility) || (reference.localOnly && reference.channelId)) return new Map();
	const inboxes = await getLocalRelayInboxes(note);
	if (reference.userHost != null) {
		for (const inbox of inboxes.keys()) if (new URL(inbox).host !== reference.userHost) inboxes.delete(inbox);
	}
	return inboxes;
}

/**
 * 購読済みのローカル相手による、署名付きの参照取得を許可する。
 * @remarks NOTE: 投稿が配送より先に参照されても解決できるようにする。followers・specified は許可を広げない。
 * @param note - 取得対象のローカルノート
 * @param reader - HTTP署名を検証した閲覧者
 * @returns 同じ範囲の投稿を既に購読できる相手なら true
 * @internal
 */
export async function isLocalRelayReader(note: Pick<Note, "userHost" | "visibility" | "localOnly" | "channelId">, reader: { host: string | null }): Promise<boolean> {
	if (!(reader.host && config.localRelayHosts?.includes(reader.host))) return false;
	for (const inbox of (await getLocalRelayInboxes(note)).keys()) {
		if (new URL(inbox).host === reader.host) return true;
	}
	return false;
}
