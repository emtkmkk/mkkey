/**
 * @packageDocumentation
 *
 * ActivityPub URI の DB 解決。自インスタンス由来 URI のパース・ノート/ユーザー/メッセージ等の解決を行う。
 *
 * @remarks
 * - **役割**: inbox や配信で AP ID からローカル/リモートのノート・ユーザー等を DB 経由で解決する。
 *
 * @see {@link queue/processors/inbox} Inbox ジョブ
 * @internal
 */
import escapeRegexp from "escape-regexp";
import config from "@/config/index.js";
import type { Note } from "@/models/entities/note.js";
import type {
	CacheableRemoteUser,
	CacheableUser,
} from "@/models/entities/user.js";
import { User, IRemoteUser } from "@/models/entities/user.js";
import type { UserPublickey } from "@/models/entities/user-publickey.js";
import type { MessagingMessage } from "@/models/entities/messaging-message.js";
import {
	Notes,
	Users,
	UserPublickeys,
	MessagingMessages,
} from "@/models/index.js";
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_USER } from "@/misc/cache-limits.js";
import {
	fetchUriPersonCache,
	fetchUserByIdCache,
	fetchUserByIdCacheMaybe,
} from "@/services/user-cache.js";
import type { IObject } from "./type.js";
import { getApId } from "./type.js";
import { resolvePerson, updatePerson } from "./models/person.js";


const publicKeyCache = new Cache<UserPublickey | null>(Infinity, {
	maxEntries: CACHE_MAX_USER,
});
const publicKeyByUserIdCache = new Cache<UserPublickey | null>(Infinity, {
	maxEntries: CACHE_MAX_USER,
});

export type UriParseResult =
	| {
			/** 自インスタンス由来の URI か */
			local: true;
			/** DB 上の ID */
			id: string;
			/** 型ヒント（例: "notes", "users"） */
			type: string;
			/** type と id の後に続くパス（id 直後のスラッシュは含まない。空なら undefined） */
			rest?: string;
	  }
	| {
			/** 自インスタンス由来の URI か */
			local: false;
			/** DB に格納している URI */
			uri: string;
	  };

export function parseUri(value: string | IObject): UriParseResult {
	const separator = "/";

	const uri = new URL(getApId(value));
	if (uri.origin !== config.url) return { local: false, uri: uri.href };

	const [, type, id, ...rest] = uri.pathname.split(separator);
	return {
		local: true,
		type,
		id,
		rest: rest.length === 0 ? undefined : rest.join(separator),
	};
}

export default class DbResolver {
	constructor() {}

	/**
	 * AP Note => Misskey Note in DB
	 */
	public async getNoteFromApId(value: string | IObject): Promise<Note | null> {
		const parsed = parseUri(value);

		if (parsed.local) {
			if (parsed.type !== "notes") return null;

			return await Notes.findOneBy({
				id: parsed.id,
			});
		} else {
			return await Notes.findOneBy({
				uri: parsed.uri,
			});
		}
	}

	public async getMessageFromApId(
		value: string | IObject,
	): Promise<MessagingMessage | null> {
		const parsed = parseUri(value);

		if (parsed.local) {
			if (parsed.type !== "notes") return null;

			return await MessagingMessages.findOneBy({
				id: parsed.id,
			});
		} else {
			return await MessagingMessages.findOneBy({
				uri: parsed.uri,
			});
		}
	}

	/**
	 * AP Person => Misskey User in DB
	 */
	public async getUserFromApId(
		value: string | IObject,
	): Promise<CacheableUser | null> {
		const parsed = parseUri(value);

		if (parsed.local) {
			if (parsed.type !== "users") return null;

			return (
				(await fetchUserByIdCacheMaybe(parsed.id, () =>
					Users.findOneBy({
						id: parsed.id,
					}).then((x) => x ?? undefined),
				)) ?? null
			);
		} else {
			return await fetchUriPersonCache(parsed.uri, () =>
				Users.findOneBy({
					uri: parsed.uri,
				}),
			);
		}
	}

	/**
	 * AP KeyId => Misskey User and Key
	 */
	public async getAuthUserFromKeyId(keyId: string): Promise<{
		user: CacheableRemoteUser;
		key: UserPublickey;
	} | null> {
		const key = await publicKeyCache.fetch(
			keyId,
			async () => {
				const key = await UserPublickeys.findOneBy({
					keyId,
				});

				if (key == null) return null;

				return key;
			},
			(key) => key != null,
		);

		if (key == null) return null;

		return {
			user: (await fetchUserByIdCache(key.userId, () =>
				Users.findOneByOrFail({ id: key.userId }),
			)) as CacheableRemoteUser,
			key,
		};
	}

	/**
	 * AP Actor id => Misskey User and Key
	 */
	public async getAuthUserFromApId(uri: string): Promise<{
		user: CacheableRemoteUser;
		key: UserPublickey | null;
	} | null> {
		const user = (await resolvePerson(uri)) as CacheableRemoteUser;

		if (user == null) return null;

		const key = await publicKeyByUserIdCache.fetch(
			user.id,
			() => UserPublickeys.findOneBy({ userId: user.id }),
			(v) => v != null,
		);

		return {
			user,
			key,
		};
	}
	public async refetchPublicKeyForApId(
		user: CacheableRemoteUser,
	): Promise<UserPublickey | null> {
		await updatePerson(user.uri!, undefined, undefined, user);
		const key = await UserPublickeys.findOneBy({ userId: user.id });
		if (key != null) {
			await publicKeyByUserIdCache.set(user.id, key);
		}
		return key;
	}

}
