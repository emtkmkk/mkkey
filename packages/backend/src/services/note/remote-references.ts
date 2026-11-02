/**
 * @packageDocumentation
 *
 * リモート親投稿の参照一覧を origin から署名付き取得し、閲覧者別キャッシュする。
 *
 * @remarks
 * - `GET /api/notes/references` 専用。ローカル親では呼ばない。
 * - キャッシュ有効期限は 7 日。親ノートの `updatedAt` がキャッシュより新しければ無効。
 *
 * @internal
 */
import { IsNull } from "typeorm";
import { genId } from "@/misc/gen-id.js";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import { NoteReferenceCaches, Users } from "@/models/index.js";
import { apGet } from "@/remote/activitypub/request.js";
import Resolver from "@/remote/activitypub/resolver.js";
import { resolveNote } from "@/remote/activitypub/models/note.js";
import { getApType, isCollectionOrOrderedCollection } from "@/remote/activitypub/type.js";
import type {
	ICollection,
	ICollectionPage,
	IObject,
} from "@/remote/activitypub/type.js";
import { toArray } from "@/prelude/array.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import type { ILocalUser } from "@/models/entities/user.js";
import promiseLimit from "promise-limit";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * origin から返る references の 1 応答。
 *
 * @remarks
 * Collection そのもの（`first` を持つ）が返る実装と、CollectionPage（`items` / `next` を持つ）が
 * 直接返る実装の両方があるため、どちらとしても読めるように省略可能な項目の交差型にしている。
 *
 * @internal
 */
type ReferencesResponse = IObject &
	Partial<Pick<ICollection, "first">> &
	Partial<Pick<ICollectionPage, "items" | "next">>;

/**
 * 親ノートの references Collection URL を組み立てる
 *
 * @param note - リモート親投稿
 * @returns references エンドポイント URL
 * @internal
 */
export function buildRemoteReferencesUrl(note: Note): string {
	if (note.uri) {
		const base = note.uri.replace(/\/+$/, "");
		if (base.endsWith("/references")) return base;
		return `${base}/references`;
	}
	if (note.url) {
		const base = note.url.replace(/\/+$/, "");
		return `${base}/references`;
	}
	throw new IdentifiableError(
		"9725d0ce-ba28-4dde-95a7-2cbb2c15de24",
		"投稿が存在しません。",
		false,
	);
}

function isCacheValid(
	cacheFetchedAt: Date,
	parentUpdatedAt: Date | null,
): boolean {
	if (Date.now() - cacheFetchedAt.getTime() > CACHE_TTL_MS) return false;
	if (parentUpdatedAt && parentUpdatedAt > cacheFetchedAt) return false;
	return true;
}

async function fetchReferenceIdsFromOrigin(
	parentNote: Note,
	viewer: ILocalUser,
): Promise<Note["id"][]> {
	const referencesUrl = buildRemoteReferencesUrl(parentNote);
	// NOTE: Resolver のコンストラクタ引数は再帰上限（数値）。閲覧者で署名させるには setUser を使う。
	// 以前は `new Resolver({ user })` と書かれており、user は設定されずインスタンスアクターで取得していた
	const resolver = new Resolver();
	resolver.setUser(viewer);

	const referenceUris: string[] = [];
	const visited = new Set<string>();

	async function collectFromPage(pageUrl: string): Promise<void> {
		if (visited.has(pageUrl)) return;
		visited.add(pageUrl);

		const page = (await apGet(pageUrl, viewer)) as ReferencesResponse;
		// NOTE: 型ガードを page に直接かけると ICollection に絞られて next が読めなくなるため、
		// 判定だけ IObject として渡し page の型は保つ
		const items = toArray(
			page.items ??
				(isCollectionOrOrderedCollection(page as IObject) &&
				typeof page.first === "object"
					? page.first.items
					: undefined),
		);
		for (const item of items) {
			if (typeof item === "string") {
				referenceUris.push(item);
			} else if (typeof item.id === "string") {
				referenceUris.push(item.id);
			}
		}

		const next = page.next;
		if (typeof next === "string" && next.length > 0) {
			await collectFromPage(next);
		}
	}

	const root = (await apGet(referencesUrl, viewer)) as ReferencesResponse;
	// NOTE: 上と同じ理由で、判定だけ IObject として渡す
	if (isCollectionOrOrderedCollection(root as IObject)) {
		const first = root.first;
		if (typeof first === "string") {
			await collectFromPage(first);
		} else if (first != null && typeof first === "object") {
			const firstItems = toArray(first.items);
			for (const item of firstItems) {
				if (typeof item === "string") referenceUris.push(item);
			}
			const next = first.next;
			if (typeof next === "string") await collectFromPage(next);
		}
		const topNext = root.next;
		if (typeof topNext === "string") await collectFromPage(topNext);
	} else {
		const items = toArray(root.items);
		for (const item of items) {
			if (typeof item === "string") referenceUris.push(item);
		}
		if (typeof root.next === "string") await collectFromPage(root.next);
	}

	const limit = promiseLimit<Note | null>(2);
	const resolved = await Promise.all(
		[...new Set(referenceUris)].slice(0, 1000).map((uri) =>
			limit(async () => {
				try {
					const obj = await resolver.resolve(uri);
					if (getApType(obj) !== "Note") return null;
					return await resolveNote(obj, resolver);
				} catch {
					return null;
				}
			}),
		),
	);

	return resolved.filter((n): n is Note => n != null).map((n) => n.id);
}

/**
 * リモート親投稿の参照一覧 ID を取得（キャッシュ優先）
 *
 * @param parentNote - リモート親投稿
 * @param viewer - 閲覧者（ローカルユーザー）
 * @returns 閲覧者から見える参照先ノート ID
 * @internal
 */
export async function resolveRemoteReferenceIds(
	parentNote: Note,
	viewer: User,
): Promise<Note["id"][]> {
	if (!parentNote.userHost) {
		throw new IdentifiableError(
			"b390d7e1-8a5e-46ed-b625-06271cafd3d3",
			"ローカル投稿にはこの API を使えません。",
			false,
		);
	}

	const cached = await NoteReferenceCaches.findOneBy({
		noteId: parentNote.id,
		userId: viewer.id,
	});

	if (
		cached &&
		isCacheValid(cached.fetchedAt, parentNote.updatedAt ?? null)
	) {
		return cached.referenceIds;
	}

	const localViewer = await Users.findOneBy({
		id: viewer.id,
		host: IsNull(),
	});
	if (!localViewer) {
		throw new IdentifiableError(
			"9725d0ce-ba28-4dde-95a7-2cbb2c15de24",
			"投稿が存在しません。",
			false,
		);
	}

	const referenceIds = await fetchReferenceIdsFromOrigin(
		parentNote,
		localViewer as ILocalUser,
	);

	const now = new Date();
	if (cached) {
		cached.referenceIds = referenceIds;
		cached.fetchedAt = now;
		await NoteReferenceCaches.save(cached);
	} else {
		await NoteReferenceCaches.insert({
			id: genId(),
			noteId: parentNote.id,
			userId: viewer.id,
			referenceIds,
			fetchedAt: now,
		});
	}

	return referenceIds;
}

/**
 * 親ノート更新時に参照キャッシュを削除する
 *
 * @param noteId - 親投稿 ID
 * @internal
 */
export async function invalidateNoteReferenceCaches(
	noteId: Note["id"],
): Promise<void> {
	await NoteReferenceCaches.delete({ noteId });
}
