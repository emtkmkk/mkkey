/**
 * @packageDocumentation
 *
 * Bluesky ユーザーを、画面で `@ハンドル@bluesky` と見せるための差し替え。
 *
 * @remarks
 * - Bluesky ユーザーは、データベースには `username` = DID から作った固定の ID、`host` = `bridgeHost` で入っている。
 *   API の出口（`Users.pack`）でだけ、`username` を今のハンドル、`host` を `bluesky` に差し替える（計画書で決定）。
 *   NB: 差し替えるのは出口だけ。差し替えた後の値をデータベースへの書き込みや検索に使わないこと。
 * - `Users.pack` から呼ぶので、重い処理（画像の取り込みなど）を読み込まない軽いファイルにしてある。
 *   取り込み・更新の本体は {@link ./actor.ts}。
 * - 今のハンドルは、プロセスの中で 10 分だけ覚えておく。プロフィールを更新したとき（`remoteUserUpdated` の知らせ）は、
 *   どのワーカーでもすぐに捨てる。
 *   NB: 知らせが届く前に、ほかのワーカーが古いハンドルでノートの投稿者情報（Redis）を作り直すことがありうる。
 *   ハンドルの変更はまれなので、そのときは次の更新か 10 分後に直るのを許す。
 *
 * @see {@link ../../models/repositories/user.ts} 差し替えを使う側
 * @internal
 */

import { In } from "typeorm";
import { subscriber } from "@/db/redis.js";
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_USER } from "@/misc/cache-limits.js";
import { AtprotoActors } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { getAtprotoConfig } from "./config.js";

// #region 定数

/**
 * 画面で Bluesky ユーザーのホスト名として見せる値。
 *
 * @remarks
 * ドットを含まないので、本物のドメインとはぶつからない。入口では `bridgeHost` と同じものとして扱う。
 */
export const BLUESKY_DISPLAY_HOST = "bluesky";

/** ハンドルが分からないときに見せる値（Bluesky の公式アプリと同じ） */
const INVALID_HANDLE = "handle.invalid";

// #endregion

/**
 * ユーザー ID → 今のハンドル の覚え書き。
 *
 * @remarks
 * 行が見つからなかった人は空文字で覚える（同じ人を何度も引かないため）。
 */
const handleCache = new Cache<string>(1000 * 60 * 10, { maxEntries: CACHE_MAX_USER });

// プロフィールが更新されたら、どのワーカーでも覚え書きを捨てる
subscriber.on("message", (_, data) => {
	const message = JSON.parse(data) as {
		channel: string;
		message: { type: string; body: { id?: User["id"] } | null };
	};
	if (message.channel === "internal" && message.message.type === "remoteUserUpdated") {
		const userId = message.message.body?.id;
		if (userId != null) handleCache.delete(userId);
	}
});

// #region 公開メソッド

/**
 * ホスト名が Bluesky ユーザーを表すものか。
 *
 * @remarks
 * 保存に使う `bridgeHost`（例: `bsky.mkkey.net`）と、画面で見せる `bluesky` の両方を Bluesky として扱う。
 * 入口（`@username@host` の解決など）で使う。ブリッジが無効なときは常に false。
 *
 * @param host - 調べるホスト名（小文字・punycode 済み）
 * @returns Bluesky ユーザーのホスト名なら true
 * @internal
 */
export function isBlueskyHost(host: string | null | undefined): boolean {
	const { enabled, bridgeHost } = getAtprotoConfig();
	return enabled && host != null && (host === bridgeHost || host === BLUESKY_DISPLAY_HOST);
}

/**
 * データベースに入っているユーザーが Bluesky ユーザーか（`host` が `bridgeHost` か）。
 *
 * @remarks
 * データベースの値には `bluesky` は入らないので、`bridgeHost` とだけ比べる。
 *
 * @param user - 調べるユーザー
 * @returns Bluesky ユーザーなら true
 * @internal
 */
export function isBlueskyUser(user: Pick<User, "host">): boolean {
	const { enabled, bridgeHost } = getAtprotoConfig();
	return enabled && user.host === bridgeHost;
}

/**
 * Bluesky ユーザーの、画面に見せる `username` と `host` を返す。
 *
 * @remarks
 * - `username` は今のハンドル、`host` は `bluesky`。
 * - ハンドルが分からない（`atproto_actor` の行が無い）ときは `handle.invalid` にする。
 * - Bluesky ユーザーでなければ、そのままの値を返す。
 *
 * @param user - 対象のユーザー
 * @returns 画面に見せる `username` と `host`
 * @internal
 */
export async function toDisplayAcct(
	user: Pick<User, "id" | "username" | "host">,
): Promise<{ username: string; host: string | null }> {
	if (!isBlueskyUser(user)) return { username: user.username, host: user.host };

	const handle = await handleCache.fetch(user.id, async () => {
		const actor = await AtprotoActors.findOne({
			where: { userId: user.id },
			select: ["handle"],
		});
		return actor?.handle ?? "";
	});
	return { username: handle || INVALID_HANDLE, host: BLUESKY_DISPLAY_HOST };
}

/**
 * 複数のユーザーのハンドルを、まとめて覚え書きに入れておく。
 *
 * @remarks
 * `Users.packMany` から呼ぶ。Bluesky ユーザーが多い一覧でも、1 人ずつデータベースを引かないため。
 *
 * @param users - 対象のユーザー（Bluesky ユーザー以外は無視する）
 * @internal
 */
export async function prefetchBlueskyHandles(
	users: Pick<User, "id" | "host">[],
): Promise<void> {
	const ids = users
		.filter((u) => isBlueskyUser(u) && handleCache.get(u.id) === undefined)
		.map((u) => u.id);
	if (ids.length === 0) return;

	const actors = await AtprotoActors.find({
		where: { userId: In(ids) },
		select: ["userId", "handle"],
	});
	const found = new Map(actors.map((a) => [a.userId, a.handle]));
	for (const id of ids) handleCache.set(id, found.get(id) ?? "");
}

// #endregion
