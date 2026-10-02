/**
 * @packageDocumentation
 *
 * 管理者が、ローカルユーザーの自前 PDS に follow / like を 1 件書き込む試験用の API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/test-write`
 * - 実装手順 5（判断の分かれ目）で、書いたレコードが Bluesky アプリに反映され、相手に通知が届くかを確かめるためのもの。
 * - mkkey のフォローやリアクションとはつながっていない。`atproto_record_map` にも残さない。
 *   書いたレコードを消すときは、返した `uri` を `admin/atproto/test-delete` に渡す。
 * - 宛先はすべて引数で渡す。
 *   - follow: `subject` に相手のハンドルか DID（例: `alice.bsky.social`）
 *   - like: `subject` に投稿の URL か URI（例: `https://bsky.app/profile/alice.bsky.social/post/3kxxx`）
 * - 同じ相手への follow や、同じ投稿への like を重ねて書いても止めない（試験用のため）。
 * - TODO: 実装手順 8（フォロー・リアクションからの自動の書き込み）ができたら、この API は消す。
 *
 * @see {@link ../../../../../remote/atproto/repo.ts} レコードの書き込み
 * @see {@link ../../../../../remote/atproto/appview.ts} 宛先の解決
 * @internal
 */
import define from "../../../define.js";
import { AtprotoIdentities } from "@/models/index.js";
import { insertModerationLog } from "@/services/insert-moderation-log.js";
import { resolveActorDid, resolvePostRef } from "@/remote/atproto/appview.js";
import { createFollowRecord, createLikeRecord } from "@/remote/atproto/repo.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description:
		"試験用。ローカルユーザーの自前 PDS に、Bluesky の follow か like を 1 件書き込む。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		/** 書き込むローカルユーザー（先に `admin/atproto/enable-user` で有効にしておく） */
		userId: { type: "string", format: "misskey:id" },
		/** 書き込む種類 */
		type: { type: "string", enum: ["follow", "like"] },
		/** follow なら相手のハンドルか DID、like なら投稿の URL か URI */
		subject: { type: "string", minLength: 1 },
	},
	required: ["userId", "type", "subject"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const identity = await AtprotoIdentities.findOneBy({ userId: ps.userId });
	if (identity == null) throw new Error("no atproto identity for the user");

	// 宛先を Bluesky の形（DID / URI と CID）に直してから書く。状態の確認は writeRecords が行う
	let result: Awaited<ReturnType<typeof createFollowRecord>>;
	let subject: string | { uri: string; cid: string };
	if (ps.type === "follow") {
		subject = await resolveActorDid(ps.subject);
		result = await createFollowRecord(identity.userId, subject);
	} else {
		subject = await resolvePostRef(ps.subject);
		result = await createLikeRecord(identity.userId, subject);
	}

	await insertModerationLog(me, "atprotoTestWrite", {
		targetId: identity.userId,
		did: identity.did,
		type: ps.type,
		subject,
		uri: result.uri,
		rev: result.rev,
	});

	return {
		did: identity.did,
		handle: identity.handle,
		type: ps.type,
		subject,
		uri: result.uri,
		cid: result.cid,
		rev: result.rev,
	};
});
