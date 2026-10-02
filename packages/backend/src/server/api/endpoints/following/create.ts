/**
 * @packageDocumentation
 *
 * 指定ユーザーをフォローする API エンドポイント。
 *
 * @remarks
 * - **API パス**: `following/create`（POST `/api/following/create` で呼び出し）
 * - 認証必須。userId で指定したユーザーをフォローする。レート制限あり。
 * - Bluesky ユーザーへのフォロー（Bluesky ブリッジ）
 *   - 初めてのときは `agreeBlueskyBridge: true` が要る（無ければ BLUESKY_BRIDGE_CONSENT_REQUIRED）。画面は確認のダイアログを出してから付け直す。
 *   - フォローは申請（pending）として返り、相手側から見えると確かめた後に成立する。
 *   - 一般公開の前は管理者だけ（BLUESKY_BRIDGE_NOT_AVAILABLE）。24 時間に 20 件まで（BLUESKY_FOLLOW_RATE_LIMITED）。
 *
 * @see {@link define} エンドポイント登録
 * @internal
 */
import create from "@/services/following/create.js";
import define from "../../define.js";
import { ApiError } from "../../error.js";
import { getUser } from "../../common/getters.js";
import { AtprotoIdentities, Followings, Users } from "@/models/index.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import { HOUR } from "@/const.js";
import type { CacheableLocalUser } from "@/models/entities/user.js";
import { isBlueskyUser } from "@/remote/atproto/display.js";
import { enableAtprotoIdentity } from "@/remote/atproto/identity.js";
import {
	BLUESKY_FOLLOW_ERRORS,
	assertBlueskyFollowAvailable,
} from "@/remote/atproto/records.js";

export const meta = {
	tags: ["following", "users"],

	limit: {
		duration: HOUR,
		max: 100,
	},

	requireCredential: true,

	kind: "write:following",

	description:
		"指定したユーザーをフォローする。リクエスト承認が必要な場合は pending になる。解除は following/delete。",

	errors: {
		noSuchUser: {
			message: "そのユーザは存在しません。",
			code: "NO_SUCH_USER",
			id: "fcd2eef9-a9b2-4c4f-8624-038099e90aa5",
		},

		followeeIsYourself: {
			message: "自分をFolloweeに指定する事は出来ません。",
			code: "FOLLOWEE_IS_YOURSELF",
			id: "26fbe7bb-a331-4857-af17-205b426669a9",
		},

		alreadyFollowing: {
			message: "既にこのユーザをfollowingしています。",
			code: "ALREADY_FOLLOWING",
			id: "35387507-38c7-4cb9-9197-300b93783fa0",
		},

		blocking: {
			message: "You are blocking that user.",
			code: "BLOCKING",
			id: "4e2206ec-aa4f-4960-b865-6c23ac38e2d9",
		},

		blocked: {
			message: "You are blocked by that user.",
			code: "BLOCKED",
			id: "c4ab57cc-4e41-45e9-bfd9-584f61e35ce0",
		},

		blueskyBridgeConsentRequired: {
			message:
				"Following a Bluesky user for the first time registers your profile on Bluesky. Retry with agreeBlueskyBridge: true.",
			code: "BLUESKY_BRIDGE_CONSENT_REQUIRED",
			id: "e3a1c7b2-5d4f-4e8a-9b6c-2f1d0a9e8b7c",
		},

		blueskyBridgeNotAvailable: {
			message: "Following Bluesky users is not available yet.",
			code: "BLUESKY_BRIDGE_NOT_AVAILABLE",
			id: "7f6e5d4c-3b2a-4190-8e7d-6c5b4a3f2e1d",
		},

		blueskyFollowRateLimited: {
			message: "You have reached the limit of Bluesky follows per 24 hours.",
			code: "BLUESKY_FOLLOW_RATE_LIMITED",
			id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		},
	},

	res: {
		type: "object",
		optional: false,
		nullable: false,
		ref: "UserLite",
	},
} as const;

export const paramDef = {
	type: "object",
	properties: {
		userId: {
			type: "string",
			format: "misskey:id",
			description: "フォローするユーザーの ID。",
		},
		agreeBlueskyBridge: {
			type: "boolean",
			description:
				"初めて Bluesky ユーザーをフォローするとき、Bluesky 上にユーザー情報を登録することに同意したか。false か省略のときは BLUESKY_BRIDGE_CONSENT_REQUIRED を返す。",
		},
	},
	required: ["userId"],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const follower = user;

	// 自分自身
	if (user.id === ps.userId) {
		throw new ApiError(meta.errors.followeeIsYourself);
	}

	// フォロー先を取得する
	const followee = await getUser(ps.userId).catch((e) => {
		if (e.id === "15348ddd-432d-49c2-8a5a-8069753becff")
			throw new ApiError(meta.errors.noSuchUser);
		throw e;
	});

	// 既にフォロー中か確認する
	const exist = await Followings.findOneBy({
		followerId: follower.id,
		followeeId: followee.id,
	});

	if (exist != null) {
		throw new ApiError(meta.errors.alreadyFollowing);
	}

	// 初めて Bluesky ユーザーをフォローするときは、同意をもらってから身元（DID）を作る
	if (isBlueskyUser(followee) && ps.agreeBlueskyBridge === true) {
		await prepareBlueskyIdentity(user);
	}

	try {
		await create(follower, followee);
	} catch (e) {
		if (e instanceof IdentifiableError) {
			if (e.id === "710e8fb0-b8c3-4922-be49-d5d93d8e6a6e")
				throw new ApiError(meta.errors.blocking);
			if (e.id === "3338392a-f764-498d-8855-db939dcf8c48")
				throw new ApiError(meta.errors.blocked);
			if (e.id === BLUESKY_FOLLOW_ERRORS.consentRequired)
				throw new ApiError(meta.errors.blueskyBridgeConsentRequired);
			if (e.id === BLUESKY_FOLLOW_ERRORS.notAvailable)
				throw new ApiError(meta.errors.blueskyBridgeNotAvailable);
			if (e.id === BLUESKY_FOLLOW_ERRORS.rateLimited)
				throw new ApiError(meta.errors.blueskyFollowRateLimited);
		}
		throw e;
	}

	// クライアントがボタン表示を即座に更新できるよう relation を含めて返す
	// （リモート/鍵アカウント宛はフォローリクエストになりストリーム通知が飛ばないため）
	return await Users.pack(followee.id, user, {
		relation: true,
	});
});

/**
 * 初めて Bluesky ユーザーをフォローする人の身元（DID・ハンドル）を用意する。
 *
 * @remarks
 * - すでに有効な身元があれば何もしない。止めていた身元は、同じ DID のまま再開する。
 * - 一般公開の前は、管理者以外には身元を作らない（plc.directory に登録した DID は消せないため、使えない人の分を作らない）。
 *
 * @param user - フォローするローカルユーザー
 * @throws 一般公開の前で管理者でないとき（API のエラーとして返す）
 * @throws 身元の発行に失敗したとき（plc.directory への登録など）
 * @internal
 */
async function prepareBlueskyIdentity(user: CacheableLocalUser): Promise<void> {
	try {
		assertBlueskyFollowAvailable(user);
	} catch {
		throw new ApiError(meta.errors.blueskyBridgeNotAvailable);
	}

	const identity = await AtprotoIdentities.findOneBy({ userId: user.id });
	if (identity?.status === "active" && identity.plcRegisteredAt != null) return;

	await enableAtprotoIdentity(await Users.findOneByOrFail({ id: user.id }));
}
