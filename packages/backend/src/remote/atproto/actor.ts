/**
 * @packageDocumentation
 *
 * Bluesky ユーザーを、mkkey のリモートユーザー（{@link User}）として取り込み、更新する。
 *
 * @remarks
 * - 保存のしかた（計画書「Bluesky ユーザーのホスト名と表示」で決定）
 *   - `username`: DID から作った固定の ID（{@link didToUsername}）。ハンドルが変わっても変えない。
 *   - `host`: 設定の `atproto.bridgeHost`（例: `bsky.mkkey.net`）。
 *   - `uri`: `at://<DID>`。ActivityPub の処理は、これを ActivityPub の URI として扱わないこと（`person.ts` で振り分ける）。
 *   - 今のハンドルは `atproto_actor.handle` に持つ。
 * - 画面に `@ハンドル@bluesky` と見せる差し替えは、API の出口で行う（実装手順 7）。ここでは保存だけを扱う。
 * - プロフィールの中身（表示名・自己紹介・アイコン・バナー・数）は、できるだけそのまま持つ。
 *   - 自己紹介の `@alice.bsky.social` は、mkkey のメンション（`@alice.bsky.social@bluesky`）に直す。
 *     そのままだと MFM が `@alice` というローカルユーザーへのメンションとして読んでしまうため。
 *   - NOTE: 自己紹介は MFM としてそのまま表示される。Bluesky の本文に MFM の記法（`$[...]` など）が入っていれば効いてしまうが、
 *     ふつうの文では起きないので、今は手を入れない。
 *   - プロフィールに成人向けなどの印が付いていたら、アイコン・バナーをセンシティブとして取り込む。
 * - `isExplorable` は false にする。本人が mkkey 側の「おすすめ」などに出ることに同意していないため。
 * - 管理者が仮想ホスト（`bridgeHost`）をインスタンスとしてブロックしたら、解決そのものをしない（ブリッジ全体を止める手段）。
 * - 新しく取り込めるかは呼び出し側が決める（`allowCreate`）。一般公開の前（`atproto.publicAccess` が false）は、
 *   管理者用 API からだけ新しく取り込む。すでに取り込んだ人を探して返すことは、いつでもできる。
 *
 * @see {@link ../../models/entities/atproto-actor.ts} DID・ハンドルの保存先
 * @see {@link ./appview.ts} プロフィールの取得
 * @internal
 */

import { db } from "@/db/postgre.js";
import { AtprotoActors, DriveFiles, Instances, Users, UserProfiles } from "@/models/index.js";
import { AtprotoActor } from "@/models/entities/atproto-actor.js";
import { User } from "@/models/entities/user.js";
import type { IRemoteUser } from "@/models/entities/user.js";
import { UserProfile } from "@/models/entities/user-profile.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { genId } from "@/misc/gen-id.js";
import { truncate } from "@/misc/truncate.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { isDuplicateKeyValueError } from "@/misc/is-duplicate-key-value-error.js";
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import { registerOrFetchInstanceDoc } from "@/services/register-or-fetch-instance-doc.js";
import { instanceChart, usersChart } from "@/services/chart/index.js";
import { publishInternalEvent } from "@/services/stream.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";
import { remoteLogger } from "../logger.js";
import { fetchPdsHost, fetchProfile, type BlueskyProfile } from "./appview.js";
import { getAtprotoConfig } from "./config.js";

/** このモジュールのログ */
const logger = remoteLogger.createSubLogger("atproto-actor", "cyan");

// #region 定数

/**
 * 画面で Bluesky ユーザーのホスト名として見せる値。
 *
 * @remarks
 * ドットを含まないので、本物のドメインとはぶつからない。入口では `bridgeHost` と同じものとして扱う。
 */
export const BLUESKY_DISPLAY_HOST = "bluesky";

/**
 * プロフィールを取り直す間隔（2026-10-02 決定）。
 *
 * @remarks
 * - 開いたとき（`@ハンドル@bluesky` などから解決したとき）は 72 時間。
 * - 新しい投稿を取り込んだときは 24 時間（{@link refreshBlueskyUserOnNewPost}。実装手順 9 の取り込みから呼ぶ）。
 * - 管理者用 API では、間隔に関係なくすぐ取り直す。
 * - フォローされている人の表示名・アイコン・ハンドルの変更は、Jetstream から変わった時点で届く予定（実装手順 9）。
 *   間隔で取り直すのは、主にフォロワー数などの数字を追いかけるため。
 */
const VIEW_RESYNC_INTERVAL_MS = 1000 * 60 * 60 * 72;
const POST_RESYNC_INTERVAL_MS = 1000 * 60 * 60 * 24;

/** 表示名と自己紹介の長さの上限（ActivityPub のリモートユーザーと同じ） */
const NAME_LENGTH = 128;
const DESCRIPTION_LENGTH = 8192;

/** これが付いたプロフィールは、アイコン・バナーをセンシティブとして取り込む */
const SENSITIVE_LABELS = ["porn", "sexual", "nudity", "graphic-media"];

/** `bsky.app` のプロフィールの URL（`https://bsky.app/profile/<ハンドルか DID>`） */
const BSKY_APP_PROFILE_URL = /^https:\/\/bsky\.app\/profile\/([^/?#]+)\/?(?:[?#].*)?$/;

/** `did:plc` の識別子の形（base32 の小文字 24 文字） */
const PLC_ID_PATTERN = /^[a-z2-7]{24}$/;

/**
 * 自己紹介の中のハンドルのメンション（`@alice.bsky.social`）。
 *
 * @remarks
 * メールアドレスの `@`（前に英数字がある）と、変換済みの `@a.b@bluesky` は拾わない。
 * 文の終わりの `.`（`@alice.bsky.social.`）はハンドルに含めない。
 */
const HANDLE_MENTION_PATTERN =
	/(^|[^\w@.])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+)(?![\w@-])(?!\.[a-zA-Z0-9])/g;

/** インスタンスティッカーに出す Bluesky の情報 */
const BLUESKY_INSTANCE_INFO = {
	name: "Bluesky",
	softwareName: "bluesky",
	iconUrl: "https://bsky.app/static/apple-touch-icon.png",
	faviconUrl: "https://bsky.app/static/favicon-32x32.png",
	themeColor: "#1185fe",
};

// #endregion

// #region 公開メソッド

/**
 * ホスト名が Bluesky ユーザーを表すものか。
 *
 * @remarks
 * 保存に使う `bridgeHost`（例: `bsky.mkkey.net`）と、画面で見せる `bluesky` の両方を Bluesky として扱う。
 * ブリッジが無効なときは常に false。
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
 * DID から、`user.username` に入れる固定の ID を作る。
 *
 * @remarks
 * - `did:plc:ewvi7nxzyoun6zhxrhs64oiz` → `ewvi7nxzyoun6zhxrhs64oiz`
 * - `did:web:example.com` → `web-example-com`（英小文字・数字以外は `-` にする）。
 *   NB: `did:web` は数が少ないので、`example.com` と `example-com` のような重なりは起きないものとして扱う。
 *   起きた場合は、後から来た方が一意制約で取り込めない。
 *
 * @param did - 対象の DID
 * @returns username
 * @throws 対応していない形の DID のとき
 * @internal
 */
export function didToUsername(did: string): string {
	if (did.startsWith("did:plc:")) {
		const id = did.slice("did:plc:".length);
		if (!PLC_ID_PATTERN.test(id)) throw new Error(`invalid did:plc: ${did}`);
		return id;
	}
	if (did.startsWith("did:web:")) {
		return `web-${did.slice("did:web:".length).toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
	}
	throw new Error(`unsupported DID method: ${did}`);
}

/**
 * Bluesky のプロフィールの URL から、ハンドルか DID を取り出す。
 *
 * @remarks
 * 照会（`ap/show`）に `https://bsky.app/profile/alice.bsky.social` のような URL が貼られたときに使う。
 * 末尾の `/`・クエリ・`#` は付いていてもよい。投稿の URL（`.../post/...`）は対象外（実装手順 9 で扱う）。
 *
 * @param url - 調べる URL
 * @returns ハンドルか DID。プロフィールの URL でなければ null
 * @internal
 */
export function parseBlueskyProfileUrl(url: string): string | null {
	const match = url.trim().match(BSKY_APP_PROFILE_URL);
	if (match == null) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		// %xx の形が壊れている URL は、プロフィールの URL ではないものとして扱う
		return null;
	}
}

/**
 * `@username@host` から Bluesky ユーザーを解決する（`resolveUser` から呼ばれる）。
 *
 * @remarks
 * - `host` が `bridgeHost` なら、`username` は固定の ID（例: `ewvi7nxz...`）として探す。
 * - `host` が `bluesky` なら、`username` はハンドル（例: `alice.bsky.social`）として探す。
 * - まだ取り込んでいない人は、`atproto.publicAccess` が true のときだけ新しく取り込む。
 *
 * @param username - ユーザー名（固定の ID かハンドル）
 * @param host - ホスト名（小文字・punycode 済み）。{@link isBlueskyHost} が true のもの
 * @returns ユーザー
 * @throws 見つからない・取り込めないとき
 * @internal
 */
export async function resolveBlueskyAcct(username: string, host: string): Promise<User> {
	const { bridgeHost, publicAccess } = getAtprotoConfig();
	const usernameLower = username.toLowerCase();

	if (host === bridgeHost) {
		const user = await Users.findOneBy({ usernameLower, host: bridgeHost });
		if (user != null) return await refreshIfStale(user, VIEW_RESYNC_INTERVAL_MS);

		// 固定の ID から DID に戻せるのは did:plc だけ（did:web は取り込み済みの人しか探せない）
		if (!PLC_ID_PATTERN.test(usernameLower)) throw new Error("user not found");
		return await resolveBlueskyActor(`did:plc:${usernameLower}`, {
			allowCreate: publicAccess,
		});
	}

	return await resolveBlueskyActor(usernameLower, { allowCreate: publicAccess });
}

/**
 * ハンドルか DID から Bluesky ユーザーを解決する。必要なら取り込み、古ければ更新する。
 *
 * @remarks
 * - 取り込み済みで、取り直してから 72 時間たっていなければ、問い合わせずに返す（`forceRefresh` ならすぐ取り直す）。
 * - ハンドルで探したときに、同じハンドルの人が複数いる（入れ替わりがあった）ときや、1 人もいないときは、
 *   AppView で今の持ち主を確かめる。
 *
 * @param actor - ハンドル（例: `alice.bsky.social`）か DID
 * @param opts.allowCreate - まだ取り込んでいない人を新しく取り込むか
 * @param opts.forceRefresh - 取り込み済みの人も、間隔に関係なくすぐ取り直すか（管理者用 API 向け）
 * @defaultValue `opts.forceRefresh` は false
 * @returns ユーザー
 * @throws AppView に見つからないとき、`allowCreate` が false で取り込んでいない人のとき
 * @throws 管理者が仮想ホスト（`bridgeHost`）をインスタンスとしてブロックしているとき
 * @internal
 */
export async function resolveBlueskyActor(
	actor: string,
	opts: { allowCreate: boolean; forceRefresh?: boolean },
): Promise<User> {
	assertEnabled();

	// 管理者が仮想ホストをインスタンスとしてブロックしていたら、ブリッジ全体を止める（2026-10-02 決定）
	if (await shouldBlockInstance(getAtprotoConfig().bridgeHost)) {
		throw new Error("the Bluesky bridge host is blocked");
	}
	const normalized = actor.trim().replace(/^@/, "").toLowerCase();

	// 取り込み済みなら、まずそれを使う（ハンドルは同じ人が 1 人だけのときに限る）
	const known = normalized.startsWith("did:")
		? await AtprotoActors.findBy({ did: normalized })
		: await AtprotoActors.findBy({ handle: normalized });
	if (known.length === 1 && !opts.forceRefresh) {
		const user = await Users.findOneBy({ id: known[0].userId });
		if (user != null) return await refreshIfStale(user, VIEW_RESYNC_INTERVAL_MS);
	}

	// 取り込んでいない・ハンドルが重なっているときは、AppView で今の持ち主を確かめる
	const profile = await fetchProfile(normalized);
	const existing = await AtprotoActors.findOneBy({ did: profile.did });
	if (existing != null) {
		return await applyProfile(existing.userId, profile);
	}

	if (!opts.allowCreate) throw new Error("user not found");
	return await createBlueskyUser(profile);
}

/**
 * 取り込み済みの Bluesky ユーザーを、今のプロフィールで更新する。
 *
 * @remarks
 * 管理画面の「リモートユーザーの情報を更新」など、`person.ts` の `updatePerson` に `at://` の URI が来たときに使う。
 *
 * @param uri - ユーザーの URI（`at://<DID>`）
 * @internal
 */
export async function updateBlueskyUserByUri(uri: string): Promise<void> {
	const user = await Users.findOneBy({ uri });
	if (user == null) return;
	const actor = await AtprotoActors.findOneBy({ userId: user.id });
	if (actor == null) return;

	await applyProfile(user.id, await fetchProfile(actor.did));
}

// #endregion

// #region 取り込み

/**
 * まだ取り込んでいない Bluesky ユーザーを取り込む。
 *
 * @remarks
 * - ユーザー・プロフィール・DID の対応を 1 つのトランザクションで作る。
 * - 同時に同じ人を取り込もうとして一意制約にぶつかったら、先にできた方を返す。
 * - アイコン・バナー・PDS の場所は、作った後に取りに行く（失敗してもユーザーは作られたまま）。
 *
 * @param profile - AppView から取ったプロフィール
 * @returns 作ったユーザー
 * @throws DID の形に対応していないとき
 * @internal
 */
async function createBlueskyUser(profile: BlueskyProfile): Promise<User> {
	const { bridgeHost } = getAtprotoConfig();
	const username = didToUsername(profile.did);
	const now = new Date();

	logger.info(`Creating a Bluesky user: ${profile.did} (${profile.handle})`);

	let user: IRemoteUser;
	try {
		await db.transaction(async (manager) => {
			user = (await manager.save(
				new User({
					id: genId(),
					createdAt: now,
					lastFetchedAt: now,
					avatarId: null,
					bannerId: null,
					name: profile.displayName ? truncate(profile.displayName, NAME_LENGTH) : null,
					username,
					usernameLower: username,
					host: bridgeHost,
					// ActivityPub の配送先は持たない（配送の処理は inbox が無い宛先を飛ばす）
					inbox: null,
					sharedInbox: null,
					uri: `at://${profile.did}`,
					followersCount: profile.followersCount ?? 0,
					followingCount: profile.followsCount ?? 0,
					notesCount: profile.postsCount ?? 0,
					isExplorable: false,
					tags: [],
					isBot: false,
					showTimelineReplies: false,
				}),
			)) as IRemoteUser;

			await manager.save(
				new UserProfile({
					userId: user.id,
					description: convertDescription(profile.description),
					url: blueskyProfileUrl(profile.did),
					fields: [],
					userHost: bridgeHost,
				}),
			);

			await manager.insert(AtprotoActor, {
				userId: user.id,
				did: profile.did,
				handle: profile.handle.toLowerCase(),
				pdsHost: null,
				createdAt: now,
				updatedAt: now,
			});
		});
	} catch (err) {
		// 同じ人を同時に取り込もうとした場合は、先にできた方を使う
		if (isDuplicateKeyValueError(err)) {
			const existing = await AtprotoActors.findOneBy({ did: profile.did });
			const found = existing ? await Users.findOneBy({ id: existing.userId }) : null;
			if (found != null) return found;
		}
		throw err;
	}

	// インスタンスの記録とチャート（ActivityPub のリモートユーザーと同じ）
	registerBridgeInstance().then((i) => {
		Instances.increment({ id: i.id }, "usersCount", 1);
		instanceChart.newUser(i.host);
	});
	usersChart.update(user!, true);

	// アイコン・バナーと PDS の場所は、失敗してもユーザー作成を止めない
	const images = await resolveProfileImages(user!, profile, null);
	await Users.update(user!.id, images);
	Object.assign(user!, images);

	const pdsHost = await fetchPdsHost(profile.did);
	if (pdsHost != null) await AtprotoActors.update(user!.id, { pdsHost });

	return user!;
}

/**
 * 取り込み済みのユーザーを、取ったプロフィールで更新する。
 *
 * @remarks
 * - ハンドルが変わっていれば `atproto_actor.handle` を書き換える。`username` は変えない。
 * - アイコン・バナーは、画像の URL が変わったときだけ取り込み直す（Bluesky の画像 URL は中身ごとに変わる）。
 *
 * @param userId - 対象のユーザー
 * @param profile - AppView から取ったプロフィール
 * @returns 更新後のユーザー
 * @throws ユーザーが見つからないとき
 * @internal
 */
async function applyProfile(userId: User["id"], profile: BlueskyProfile): Promise<User> {
	const user = (await Users.findOneByOrFail({ id: userId })) as IRemoteUser;
	const now = new Date();

	const images = await resolveProfileImages(user, profile, user);

	await Users.update(user.id, {
		lastFetchedAt: now,
		name: profile.displayName ? truncate(profile.displayName, NAME_LENGTH) : null,
		followersCount: profile.followersCount ?? user.followersCount,
		followingCount: profile.followsCount ?? user.followingCount,
		notesCount: profile.postsCount ?? user.notesCount,
		isDeleted: false,
		...images,
	});
	await UserProfiles.update(
		{ userId: user.id },
		{
			description: convertDescription(profile.description),
			url: blueskyProfileUrl(profile.did),
		},
	);
	await AtprotoActors.update(user.id, {
		handle: profile.handle.toLowerCase(),
		updatedAt: now,
	});

	// ユーザー情報のキャッシュを捨てさせる（ActivityPub のリモートユーザーの更新と同じ）
	publishInternalEvent("remoteUserUpdated", { id: user.id });

	return await Users.findOneByOrFail({ id: user.id });
}

/**
 * 新しい投稿を取り込んだときに、取り直してから 24 時間たっていればプロフィールを更新する。
 *
 * @remarks
 * 実装手順 9 の投稿の取り込みから呼ぶ。失敗しても例外にしない（{@link refreshIfStale}）。
 *
 * @param user - 投稿した Bluesky ユーザー
 * @returns ユーザー（更新できたら更新後のもの）
 * @internal
 */
export async function refreshBlueskyUserOnNewPost(user: User): Promise<User> {
	return await refreshIfStale(user, POST_RESYNC_INTERVAL_MS);
}

/**
 * 取り直してから指定の時間がたっていれば更新し、そうでなければそのまま返す。
 *
 * @remarks
 * 更新に失敗しても（AppView が落ちているなど）、手元にあるユーザーを返す。
 * 何度も問い合わせないよう、試す前に `lastFetchedAt` を進める（ActivityPub のリモートユーザーと同じ）。
 *
 * @param user - 対象のユーザー
 * @param intervalMs - 取り直す間隔（ミリ秒）
 * @returns ユーザー（更新できたら更新後のもの）
 * @internal
 */
async function refreshIfStale(user: User, intervalMs: number): Promise<User> {
	if (
		user.lastFetchedAt != null &&
		Date.now() - user.lastFetchedAt.getTime() <= intervalMs
	) {
		return user;
	}

	await Users.update(user.id, { lastFetchedAt: new Date() });
	const actor = await AtprotoActors.findOneBy({ userId: user.id });
	if (actor == null) return user;

	try {
		return await applyProfile(user.id, await fetchProfile(actor.did));
	} catch (err) {
		logger.warn(`Failed to refresh the Bluesky user ${actor.did}: ${err}`);
		return user;
	}
}

// #endregion

// #region 変換処理

/**
 * 自己紹介を、mkkey で表示する形にする。
 *
 * @remarks
 * `@alice.bsky.social` を `@alice.bsky.social@bluesky` に直す（ファイル先頭の説明を参照）。
 *
 * @param description - Bluesky の自己紹介
 * @returns mkkey の自己紹介。空なら null
 * @internal
 */
function convertDescription(description: string | undefined): string | null {
	if (!description) return null;
	return truncate(
		description.replace(HANDLE_MENTION_PATTERN, `$1@$2@${BLUESKY_DISPLAY_HOST}`),
		DESCRIPTION_LENGTH,
	);
}

/**
 * Bluesky 上のプロフィールの URL を作る。
 *
 * @remarks
 * ハンドルは変わるので、DID で作る（`bsky.app` は DID でも開ける）。
 *
 * @param did - 対象の DID
 * @returns `https://bsky.app/profile/<DID>`
 * @internal
 */
function blueskyProfileUrl(did: string): string {
	return `https://bsky.app/profile/${did}`;
}

/**
 * プロフィールのアイコン・バナーを取り込み、ユーザーに入れる値を作る。
 *
 * @remarks
 * - 画像の URL が前と同じなら、前のファイルを使う（取り込み直さない）。
 * - プロフィールから画像が消えていたら null にする。
 * - 取り込みに失敗したら、前のファイルのままにする（作成時は null）。
 *
 * @param user - 画像の持ち主
 * @param profile - AppView から取ったプロフィール
 * @param current - 今のユーザー（新しく作るときは null）
 * @returns `avatarId` と `bannerId`
 * @internal
 */
async function resolveProfileImages(
	user: IRemoteUser,
	profile: BlueskyProfile,
	current: Pick<User, "avatarId" | "bannerId"> | null,
): Promise<{ avatarId: DriveFile["id"] | null; bannerId: DriveFile["id"] | null }> {
	const sensitive = (profile.labels ?? []).some((l) => SENSITIVE_LABELS.includes(l.val));
	const [avatarId, bannerId] = await Promise.all(
		([
			[profile.avatar, current?.avatarId ?? null],
			[profile.banner, current?.bannerId ?? null],
		] as const).map(async ([url, currentId]) => {
			if (!url) return null;
			try {
				return (await fetchImage(user, url, sensitive)).id;
			} catch (err) {
				logger.warn(`Failed to fetch a profile image ${url}: ${err}`);
				return currentId;
			}
		}),
	);
	return { avatarId, bannerId };
}

/**
 * 画像の URL から、ドライブのファイルを用意する。
 *
 * @remarks
 * 同じユーザーの同じ URL のファイルがあれば、それを使う。無ければリモートのファイルとして取り込む
 * （`cacheRemoteFiles` が false なら、中身は持たずにリンクだけ持つ）。
 *
 * @param user - 画像の持ち主
 * @param url - 画像の URL
 * @param sensitive - センシティブとして取り込むか
 * @returns ドライブのファイル
 * @throws 取り込みに失敗したとき
 * @internal
 */
async function fetchImage(user: IRemoteUser, url: string, sensitive: boolean): Promise<DriveFile> {
	const existing = await DriveFiles.findOneBy({ userId: user.id, uri: url });
	if (existing != null) return existing;

	const meta = await fetchMeta();
	return await uploadFromUrl({
		url,
		user,
		uri: url,
		sensitive,
		isLink: !meta.cacheRemoteFiles,
	});
}

// #endregion

// #region 非公開ヘルパー

/**
 * ブリッジが有効かを確かめる。
 *
 * @throws ブリッジが無効なとき
 * @internal
 */
function assertEnabled(): void {
	if (!getAtprotoConfig().enabled) {
		throw new Error("the Bluesky bridge is disabled (atproto.enabled)");
	}
}

/**
 * Bluesky ユーザー用の仮想ホストを、インスタンスとして登録する（無ければ作る）。
 *
 * @remarks
 * - インスタンスティッカーが Bluesky だと分かる表示を出せるよう、名前・アイコン・色を入れる。
 * - この仮想ホストには nodeinfo が無いので、ふつうのインスタンス情報の取得（`fetchInstanceMetadata`）は
 *   動かさない（そちらでも仮想ホストを飛ばすようにしてある）。
 *
 * @returns インスタンスの行
 * @internal
 */
async function registerBridgeInstance() {
	const instance = await registerOrFetchInstanceDoc(getAtprotoConfig().bridgeHost);
	if (instance.softwareName !== BLUESKY_INSTANCE_INFO.softwareName) {
		await Instances.update(instance.id, {
			...BLUESKY_INSTANCE_INFO,
			infoUpdatedAt: new Date(),
		});
	}
	return instance;
}

// #endregion
