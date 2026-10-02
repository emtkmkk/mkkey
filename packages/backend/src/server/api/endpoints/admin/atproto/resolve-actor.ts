/**
 * @packageDocumentation
 *
 * 管理者が、ハンドルか DID を指定して Bluesky ユーザーを mkkey に取り込む API。
 *
 * @remarks
 * - **API パス**: `admin/atproto/resolve-actor`
 * - 一般公開の前（`atproto.publicAccess` が false）は、Bluesky ユーザーを新しく取り込めるのはこの API だけ。
 *   取り込んだ人は `@<固定の ID>@<bridgeHost>` として、誰からでも見られる。
 * - 取り込み済みなら、プロフィールを取り直して返す（24 時間以内に取り直していれば、そのまま返す）。
 *
 * @see {@link ../../../../../remote/atproto/actor.ts} 取り込み
 * @internal
 */
import define from "../../../define.js";
import { AtprotoActors, Users } from "@/models/index.js";
import { resolveBlueskyActor } from "@/remote/atproto/actor.js";

export const meta = {
	tags: ["admin"],

	requireCredential: true,
	requireAdmin: true,
	kind: "write:admin:federation",

	description: "ハンドルか DID を指定して、Bluesky ユーザーを mkkey に取り込む。",
} as const;

export const paramDef = {
	type: "object",
	properties: {
		/** ハンドル（例: `alice.bsky.social`）か DID（例: `did:plc:xxx`） */
		actor: { type: "string", minLength: 1 },
	},
	required: ["actor"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await resolveBlueskyActor(ps.actor, { allowCreate: true });
	const actor = await AtprotoActors.findOneByOrFail({ userId: user.id });

	return {
		did: actor.did,
		handle: actor.handle,
		pdsHost: actor.pdsHost,
		user: await Users.pack(user, me, { detail: true }),
	};
});
