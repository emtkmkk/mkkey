/**
 * @packageDocumentation
 *
 * API およびストリーミング用の認証。トークンからユーザー・アプリを解決する。
 *
 * @remarks
 * - **役割**: Authorization ヘッダーまたはクエリのトークンから AccessToken を解決し、ユーザーとアプリを返す。
 * - API の api-handler とストリーミング接続の両方で利用される。
 * - `AUTH_USER_SELECT` はストリーム TL 等でも参照する。列を抜くと `undefined` になり、`!user.flag`（既定 true のフラグ）で誤って制限が掛かる。
 * - 既定 **false** のフラグは `!undefined` が制限側に寄るため事故は起きにくいが、明示比較（`=== false` / `!== true`）の方が安全。
 * - **投稿・設定系**では `movedToUri` / `isMiniSilenced` / `canInvite` / `isLocked` 等も参照する。欠けると移行済みアカウントのブロックや公開制限が効かない。
 * - **`isDeleted`**: 削除済みアカウントのゲート（{@link call} / {@link streaming}）が参照する。
 *   アカウント削除はソフト削除でトークン行が残り得るため、この列を抜くと削除済みユーザーが投稿できてしまう。
 * - **`moderationWarningPopupAt`**: `user` 列ではなく `moderation_warning_popup_ack` を `hydrateModerationWarningPopupAtForAuthUser` で注入。当日の警告 ACK 前は API / ストリームを制限するゲートに使う。
 * - **custom-motd**（任意認証）では `createdAt` / `notesCount` / `name` / `isCat` / `speakAsCat` を参照する。`birthday` は {@link UserProfile} 側のため User には無い。
 * - **notes/create** は `services/note/create` の投稿処理へ認証ユーザを渡し、`blockPost*` / `isSilenced` / `maxRankPoint` / `isBot` / `isPublicLikeList` / `avatarId` 等で可視性・スパム系の分岐を行う。
 *   なお周年バッジの進捗・通知（`notesPostDays` 等）は、キャッシュされた本オブジェクトではなく
 *   `updateAnniversaryProgress` 側で DB の現在値をアトミックに読んで判定する（キャッシュ由来の二重通知を防ぐため）。
 * - 認証成功時の {@link touchLastActiveDateOnLogin} で `lastActiveDate` 更新に加え、休眠削除予告の `inactiveDeletionWarnedAt` をクリアする。
 *   以前は毎リクエスト SELECT + UPDATE していたが、索引付き列への高頻度更新を避けるため 1 分間引きにした。
 *
 * @see {@link api-handler} API 認証
 * @see {@link streaming} ストリーム接続認証
 * @internal
 */
import isNativeToken from "./common/is-native-token.js";
import type { CacheableLocalUser, ILocalUser } from "@/models/entities/user.js";
import { Users, AccessTokens, Apps } from "@/models/index.js";
import type { AccessToken } from "@/models/entities/access-token.js";
import { Cache } from "@/misc/cache.js";
import { CACHE_MAX_APP } from "@/misc/cache-limits.js";
import type { App } from "@/models/entities/app.js";
import { fetchAuthUserByTokenCache } from "@/services/user-cache.js";
import { touchLastActiveDateOnLogin } from "@/services/update-last-active-date.js";
import { hydrateModerationWarningPopupAtForAuthUser } from "@/misc/moderation-warning-ack.js";

const appCache = new Cache<App>(Infinity, { maxEntries: CACHE_MAX_APP });

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthenticationError";
	}
}

const AUTH_USER_SELECT = {
	id: true,
	username: true,
	name: true,
	host: true,
	createdAt: true,
	isSuspended: true,
	isUsagePaused: true,
	// 削除済みアカウントの API / ストリーム拒否（call.ts, streaming.ts）。
	// 抜くと user.isDeleted が undefined になり、下流のゲートが素通りする
	isDeleted: true,
	isModerationWarning: true,
	isAdmin: true,
	isModerator: true,
	driveCapacityOverrideMb: true,
	emojis: true,
	// 移行先 URI ありなら投稿等を拒否（notes/create, reactions/create, antennas/create, i/move 等）
	movedToUri: true,
	// ミニサイレンス時の公開投稿制限（notes/create）
	isMiniSilenced: true,
	// CC 複数宛の可否（notes/create）
	canInvite: true,
	// 鍵解除の可否判定（i/update, i/known-as）
	isLocked: true,
	notesCount: true,
	// 投稿サービス: サイレンス・公開範囲・初投稿・スパム系ヒューリスティック（services/note/create）
	isSilenced: true,
	maxRankPoint: true,
	isBot: true,
	isPublicLikeList: true,
	avatarId: true,
	blockPostPublic: true,
	blockPostHome: true,
	blockPostNotLocal: true,
	blockPostNotLocalPublic: true,
	isCat: true,
	speakAsCat: true,
	// ストリーム TL が参照するが、未選択だと undefined になり !flag で誤ってノートを落とす
	localShowRenote: true,
	remoteShowRenote: true,
	showTimelineReplies: true,
	showSelfRenoteToHome: true,
	// spotlight ストリームの閾値用（未選択だと undefined になり比較が壊れる）
	followingCount: true,
} as const;

export default async (
	authorization: string | null | undefined,
	bodyToken: string | null,
): Promise<
	[CacheableLocalUser | null | undefined, AccessToken | null | undefined]
> => {
	let token: string | null = null;

	// check if there is an authorization header set
	if (authorization != null) {
		if (bodyToken != null) {
			throw new AuthenticationError("using multiple authorization schemes");
		}

		// check if OAuth 2.0 Bearer tokens are being used
		// Authorization schemes are case insensitive
		if (authorization.substring(0, 7).toLowerCase() === "bearer ") {
			token = authorization.substring(7);
		} else {
			throw new AuthenticationError("unsupported authentication scheme");
		}
	} else if (bodyToken != null) {
		token = bodyToken;
	} else {
		return [null, null];
	}

	if (isNativeToken(token)) {
		const user = await fetchAuthUserByTokenCache(token, async () => {
			const authUser = await Users.findOne({
				where: { token },
				select: AUTH_USER_SELECT,
			});
			if (authUser == null) {
				return null;
			}
			await hydrateModerationWarningPopupAtForAuthUser(authUser);
			return authUser as ILocalUser;
		});

		if (user == null) {
			throw new AuthenticationError("unknown token");
		}

		await touchLastActiveDateOnLogin(user);
		return [user, null];
	} else {
		const accessToken = await AccessTokens.findOne({
			where: [
				{
					hash: token.toLowerCase(), // app
				},
				{
					token: token, // miauth
				},
			],
		});

		if (accessToken == null) {
			throw new AuthenticationError("unknown token");
		}

		AccessTokens.update(accessToken.id, {
			lastUsedAt: new Date(),
		});

		const user = await fetchAuthUserByTokenCache(token, async () => {
			const authUser = await Users.findOne({
				where: {
					id: accessToken.userId,
				},
				select: AUTH_USER_SELECT,
			});
			if (authUser == null) {
				return null;
			}
			await hydrateModerationWarningPopupAtForAuthUser(authUser);
			return authUser as CacheableLocalUser;
		});

		if (user == null) {
			throw new AuthenticationError("unknown token");
		}

		await touchLastActiveDateOnLogin(user);

		if (accessToken.appId) {
			const app = await appCache.fetch(accessToken.appId, () =>
				Apps.findOneByOrFail({ id: accessToken.appId! }),
			);

			return [
				user,
				{
					id: accessToken.id,
					permission: app.permission,
				} as AccessToken,
			];
		} else {
			return [user, accessToken];
		}
	}
};
