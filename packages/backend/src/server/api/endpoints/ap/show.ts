/**
 * @packageDocumentation
 *
 * ActivityPub オブジェクト（Actor/Note 等）の詳細を取得する API エンドポイント。
 *
 * @remarks
 * - **API パス**: `ap/show`（GET `/api/ap/show` で呼び出し）
 * - 認証不要。uri で指定した ActivityPub のオブジェクトを解決し、ローカル用の表現で返す。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import define from "../../define.js";
import { createPerson } from "@/remote/activitypub/models/person.js";
import { createNote } from "@/remote/activitypub/models/note.js";
import DbResolver from "@/remote/activitypub/db-resolver.js";
import Resolver from "@/remote/activitypub/resolver.js";
import { ApiError } from "../../error.js";
import { extractDbHost } from "@/misc/convert-host.js";
import { Users, Notes } from "@/models/index.js";
import type { Note } from "@/models/entities/note.js";
import type { CacheableLocalUser, User } from "@/models/entities/user.js";
import { isActor, isPost, getApId } from "@/remote/activitypub/type.js";
import type { SchemaType } from "@/misc/schema.js";
import { MINUTE } from "@/const.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";
import { updateQuestion } from "@/remote/activitypub/models/question.js";
import { populatePoll } from "@/models/repositories/note.js";
import { redisClient } from "@/db/redis.js";

export const meta = {
	tags: ["federation"],

	requireCredential: true,

	limit: {
		duration: MINUTE,
		max: 10,
	},

	errors: {
		noSuchObject: {
			message: "そのobjectは存在しません。",
			code: "NO_SUCH_OBJECT",
			id: "dc94d745-1262-4e63-a17d-fecaa57efc82",
		},
	},

	res: {
		optional: false,
		nullable: false,
		oneOf: [
			{
				type: "object",
				properties: {
					type: {
						type: "string",
						optional: false,
						nullable: false,
						enum: ["User"],
					},
					object: {
						type: "object",
						optional: false,
						nullable: false,
						ref: "UserDetailedNotMe",
					},
				},
			},
			{
				type: "object",
				properties: {
					type: {
						type: "string",
						optional: false,
						nullable: false,
						enum: ["Note"],
					},
					object: {
						type: "object",
						optional: false,
						nullable: false,
						ref: "Note",
					},
				},
			},
		],
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		uri: { type: "string" },
	},
	required: ["uri"],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const object = await fetchAny(ps.uri, me);
	if (object) {
		return object;
	} else {
		throw new ApiError(meta.errors.noSuchObject);
	}
});

/***
 * Resolve User or Note from URI
 */
async function fetchAny(
	uri: string,
	me: CacheableLocalUser | null | undefined,
): Promise<SchemaType<typeof meta["res"]> | null> {
	// ブロック中なら待機する。
	if (await shouldBlockInstance(extractDbHost(uri))) return null;

	const dbResolver = new DbResolver();

	const [user, note] = await Promise.all([
		dbResolver.getUserFromApId(uri),
		dbResolver.getNoteFromApId(uri),
	]);
	let local = await mergePack(me, user, note);
	if (local) {
		if (local.type === "Note" && note?.uri && note.hasPoll) {
			// 保存済み（リモート）ノートにアンケートが含まれる場合は questions を更新する
			const key = `pollFetched:${note.uri}`;
			const acquired = await redisClient.set(key, "1", "EX", 60, "NX");
			if (acquired !== null) {
				if (await updateQuestion(note.uri)) {
					local.object.poll = await populatePoll(note, me?.id ?? null);
				}
			}
		}
		return local;
	}

	// リモートから Object を1回取得する
	const resolver = new Resolver();
	resolver.setUser(me);
	const object = await resolver.resolve(uri);

	// /@user If a URI other than the id is specified,
	// ここで URI が決まる
	if (uri !== object.id) {
		local = await mergePack(
			me,
			...(await Promise.all([
				dbResolver.getUserFromApId(getApId(object)),
				dbResolver.getNoteFromApId(getApId(object)),
			])),
		);
		if (local != null) return local;
	}

	return await mergePack(
		me,
		isActor(object)
			? await createPerson(getApId(object), resolver.reset())
			: null,
		isPost(object)
			? await createNote(getApId(object), resolver.reset(), true)
			: null,
	);
}

async function mergePack(
	me: CacheableLocalUser | null | undefined,
	user: User | null | undefined,
	note: Note | null | undefined,
): Promise<SchemaType<typeof meta.res> | null> {
	if (user != null) {
		return {
			type: "User",
			object: await Users.pack(user, me, { detail: true }),
		};
	} else if (note != null) {
		try {
			const object = await Notes.pack(note, me, { detail: true });

			return {
				type: "Note",
				object,
			};
		} catch (e) {
			return null;
		}
	}

	return null;
}
