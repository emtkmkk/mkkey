/**
 * @packageDocumentation
 *
 * ローカルのリノートを ActivityPub の Announce にレンダリングする。
 *
 * @remarks
 * 宛先はリモートから見た公開範囲（`misc/semi-public.ts` の `getRemoteVisibility`）で決め、
 * ノート本体の Create（`renderer/note.ts`）と同じ範囲になるようにしている。
 * 連合しない投稿（チャンネルのローカル限定・hidden）では null を返す。
 *
 * @internal
 */
import config from "@/config/index.js";
import type { Note, IMentionedRemoteUsers } from "@/models/entities/note.js";
import { apLogger } from "../logger.js";
import { getRemoteVisibility } from "@/misc/semi-public.js";

/**
 * リノートの Announce アクティビティを作る
 *
 * @param object - リノート先の URI
 * @param note - リノート（ローカルノート）
 * @returns Announce。連合しない投稿なら null
 * @internal
 */
export default (object: any, note: Note) => {
	const attributedTo = `${config.url}/users/${note.userId}`;

	let mentions: string[] = [];
	try {
		mentions = (
			JSON.parse(note.mentionedRemoteUsers) as IMentionedRemoteUsers
		)?.map((x) => x.uri);
	} catch(e) {
		apLogger.warn("failed to parse mentionedRemoteUsers", { e });
	}

	let to: string[] = [];
	let cc: string[] = [];

	// 宛先はリモートから見た公開範囲で決める（localOnly はフォロワー限定、セミパブリックは公開になる）
	const remoteVisibility = getRemoteVisibility(note);

	if (remoteVisibility === "public") {
		to = ["https://www.w3.org/ns/activitystreams#Public"];
		cc = [`${attributedTo}/followers`];
	} else if (remoteVisibility === "home") {
		to = [`${attributedTo}/followers`];
		cc = ["https://www.w3.org/ns/activitystreams#Public"];
	} else if (remoteVisibility === "followers") {
		to = [`${attributedTo}/followers`];
	} else if (remoteVisibility === "specified") {
		to = mentions;
	} else {
		return null;
	}

	return {
		id: `${config.url}/notes/${note.id}/activity`,
		actor: `${config.url}/users/${note.userId}`,
		type: "Announce",
		published: note.createdAt.toISOString(),
		to,
		cc,
		object,
	};
};
