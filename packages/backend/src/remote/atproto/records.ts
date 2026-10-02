/**
 * @packageDocumentation
 *
 * mkkey のフォロー・リアクションを、自前 PDS の follow / like として Bluesky に書き込む。
 *
 * @remarks
 * - 流れ（フォロー）
 *   1. `following/create` から {@link requestBlueskyFollow} が呼ばれる。公開前の制限・身元（同意）・1 日の上限を確かめ、
 *      既存のフォロー申請（FollowRequest）を作って、`atprotoFollow` ジョブを積む。
 *   2. ジョブ（`atprotoFollow`）が follow を書き、相手側から見えるか（AppView の `getRelationships`）を確かめる。
 *      見えたら申請を承認して、フォローを成立させる。まだ見えなければ、時間を置いてやり直す。
 *   3. 一定時間（{@link FOLLOW_JOB_OPTIONS} で約 30 分）見えなければ、または相手にブロックされていれば、申請を取り消す。
 *      取り消すと `atprotoUnfollow` ジョブが積まれ、書いた follow も消える。
 *   計画書「取り込みの条件」の「相手から見えるまでは申請中として扱い、TL に何も流さない」を、既存のフォロー申請で表している。
 * - 流れ（フォロー解除・申請の取り消し）: `atprotoUnfollow` ジョブが、mkkey が書いた follow を消す。
 * - 流れ（リアクション）: Bluesky のノートへのリアクションは、ActivityPub に送らずに `atprotoLike` ジョブを積む。
 *   取り消しは `atprotoUnlike`。like の宛先（投稿の URI と CID）は、投稿を取り込んだときの対応表（実装手順 9）から引く。
 * - ジョブは何度やり直しても同じ結果になるように書く（書いたかどうかは `atproto_record_map` で判断する）。
 * - TODO: `#nobridge` などの同意の判定と、受け入れられた後のブロックの検知は、実装手順 10 で足す。
 * - TODO: 確認できずに取り消したことを、フォローした人に知らせる（今はフォロー申請が消えるだけ）。
 * - QUESTION: like にも回数の上限を付けるか（計画書「あとで決めればよいこと」）。
 *
 * @see {@link ./repo.ts} レコードの書き込み
 * @see {@link ../../models/entities/atproto-record-map.ts} 書いたレコードと mkkey のデータの対応
 * @internal
 */

import type Bull from "bull";
import { redisClient } from "@/db/redis.js";
import { genId } from "@/misc/gen-id.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import {
	AtprotoActors,
	AtprotoIdentities,
	AtprotoRecordMaps,
	FollowRequests,
	Followings,
	NoteReactions,
	Users,
} from "@/models/index.js";
import type { AtprotoIdentity } from "@/models/entities/atproto-identity.js";
import type { Note } from "@/models/entities/note.js";
import type { User } from "@/models/entities/user.js";
import { createAtprotoRecordJob } from "@/queue/index.js";
import acceptFollowRequest from "@/services/following/requests/accept.js";
import cancelFollowRequest from "@/services/following/requests/cancel.js";
import createFollowRequest from "@/services/following/requests/create.js";
import { remoteLogger } from "../logger.js";
import { fetchRelationship } from "./appview.js";
import { getAtprotoConfig } from "./config.js";
import { createFollowRecord, createLikeRecord, deleteBridgeRecord } from "./repo.js";

/** このモジュールのログ */
const logger = remoteLogger.createSubLogger("atproto-records", "cyan");

// #region 定数

/** 1 人が 24 時間に Bluesky ユーザーをフォローできる数（2026-10-02 決定。PDS を全員で共有しているため） */
export const BLUESKY_FOLLOW_DAILY_LIMIT = 20;

/** フォローの上限を数える期間 */
const FOLLOW_QUOTA_WINDOW_MS = 1000 * 60 * 60 * 24;

/**
 * 例外の ID。API（`following/create`）でエラーの種類に変えるのに使う。
 *
 * @remarks
 * 値を変えると、API のエラーの変換が効かなくなるので変えないこと。
 */
export const BLUESKY_FOLLOW_ERRORS = {
	/** 一般公開の前で、管理者以外は使えない */
	notAvailable: "0b8f3a52-6c1e-4d7a-9e2b-3f5c8d1a7e64",
	/** 身元がまだ無い（初めての Bluesky ユーザーのフォローで、同意をもらっていない） */
	consentRequired: "4d2e9f71-8a3b-4c5d-b6e7-1f0a2c3d4e5f",
	/** 24 時間のフォローの上限に達した */
	rateLimited: "9c7b6a5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d",
} as const;

/**
 * `atprotoFollow` ジョブのやり直しの設定。
 *
 * @remarks
 * 15 秒から倍々に待って 8 回まで（合計で約 30 分）。それでも相手側から見えなければ申請を取り消す。
 * 書いた直後は AppView に反映されていないことが多いので、1 回目の確認はたいてい失敗して 15 秒後にやり直しになる。
 */
const FOLLOW_JOB_OPTIONS = {
	attempts: 8,
	backoff: { type: "exponential", delay: 15 * 1000 },
} as const;

/** follow / like の削除と like の書き込みのやり直しの設定（10 秒から倍々に 5 回まで） */
const RECORD_JOB_OPTIONS = {
	attempts: 5,
	backoff: { type: "exponential", delay: 10 * 1000 },
} as const;

// #endregion

// #region 型

/**
 * レコードのジョブの中身。
 *
 * @internal
 */
export type AtprotoRecordJobData = {
	/** 操作したローカルユーザー */
	userId: User["id"];
	/** follow / unfollow ならフォロー先の Bluesky ユーザー、like / unlike ならノート */
	targetId: string;
};

/**
 * ジョブの種類。
 *
 * @internal
 */
export type AtprotoRecordJobName =
	| "atprotoFollow"
	| "atprotoUnfollow"
	| "atprotoLike"
	| "atprotoUnlike";

// #endregion

// #region mkkey の操作からの入口

/**
 * mkkey から Bluesky ユーザーへのフォローを受け付ける（`services/following/create.ts` から呼ばれる）。
 *
 * @remarks
 * - フォロー申請を作り、follow を書くジョブを積むところまで行う。フォローが成立するのは、ジョブが相手側から見えると確かめた後。
 * - すでに申請中なら何もしない。
 * - 身元（DID）が無いときは作らずに例外にする。身元を作るのは、同意をもらった API（`following/create` の
 *   `agreeBlueskyBridge`）だけ。インポートなど、ほかの経路から勝手に作らないため。
 *
 * @param follower - フォローするローカルユーザー
 * @param followee - フォローされる Bluesky ユーザー
 * @param requestId - フォロー申請の ID（あれば）
 * @throws {@link BLUESKY_FOLLOW_ERRORS} の ID を持つ IdentifiableError（公開前・身元が無い・上限に達した）
 * @internal
 */
export async function requestBlueskyFollow(
	follower: User,
	followee: User,
	requestId?: string,
): Promise<void> {
	assertBlueskyFollowAvailable(follower);

	const identity = await AtprotoIdentities.findOneBy({ userId: follower.id });
	if (!isUsableIdentity(identity)) {
		throw new IdentifiableError(
			BLUESKY_FOLLOW_ERRORS.consentRequired,
			"consent is required before following Bluesky users for the first time",
		);
	}

	// すでに申請中なら、もう一度積まない（ジョブがやり直し中）
	if (
		await FollowRequests.exist({
			where: { followerId: follower.id, followeeId: followee.id },
		})
	) {
		return;
	}

	await consumeFollowQuota(follower.id);
	await createFollowRequest(follower, followee, requestId);
	await createAtprotoRecordJob("atprotoFollow", { userId: follower.id, targetId: followee.id }, FOLLOW_JOB_OPTIONS);
}

/**
 * Bluesky ユーザーのフォローを使える人かを確かめる。
 *
 * @remarks
 * 一般公開の前（`atproto.publicAccess` が false）は管理者だけ。`following/create` で身元を作る前にも呼ぶ。
 *
 * @param user - 確かめるローカルユーザー
 * @throws 使えないとき（{@link BLUESKY_FOLLOW_ERRORS.notAvailable}）
 * @internal
 */
export function assertBlueskyFollowAvailable(user: Pick<User, "isAdmin">): void {
	if (!getAtprotoConfig().publicAccess && !user.isAdmin) {
		throw new IdentifiableError(
			BLUESKY_FOLLOW_ERRORS.notAvailable,
			"following Bluesky users is not available yet",
		);
	}
}

/**
 * Bluesky ユーザーへのフォローの解除・申請の取り消しを受けて、書いた follow を消すジョブを積む。
 *
 * @param followerId - フォローしていたローカルユーザー
 * @param followeeId - フォローされていた Bluesky ユーザー
 * @internal
 */
export async function onBlueskyUnfollow(
	followerId: User["id"],
	followeeId: User["id"],
): Promise<void> {
	await createAtprotoRecordJob("atprotoUnfollow", { userId: followerId, targetId: followeeId }, RECORD_JOB_OPTIONS);
}

/**
 * Bluesky のノートへのリアクションを受けて、like を書くジョブを積む。
 *
 * @param userId - リアクションしたローカルユーザー
 * @param noteId - リアクションされたノート（Bluesky 由来）
 * @internal
 */
export async function onBlueskyReaction(userId: User["id"], noteId: Note["id"]): Promise<void> {
	await createAtprotoRecordJob("atprotoLike", { userId, targetId: noteId }, RECORD_JOB_OPTIONS);
}

/**
 * Bluesky のノートへのリアクションの取り消しを受けて、書いた like を消すジョブを積む。
 *
 * @param userId - リアクションを取り消したローカルユーザー
 * @param noteId - 対象のノート（Bluesky 由来）
 * @internal
 */
export async function onBlueskyUnreaction(userId: User["id"], noteId: Note["id"]): Promise<void> {
	await createAtprotoRecordJob("atprotoUnlike", { userId, targetId: noteId }, RECORD_JOB_OPTIONS);
}

// #endregion

// #region ジョブの処理

/**
 * `atprotoFollow` ジョブ: follow を書き、相手側から見えたらフォローを成立させる。
 *
 * @param job - ジョブ
 * @returns 結果の説明（ジョブの記録用）
 * @throws まだ相手側から見えないとき（時間を置いてやり直させるため）、書き込みに失敗したとき
 * @internal
 */
async function followJob(job: Bull.Job<AtprotoRecordJobData>): Promise<string> {
	const { userId, targetId } = job.data;
	const [follower, followee] = await Promise.all([
		Users.findOneBy({ id: userId }),
		Users.findOneBy({ id: targetId }),
	]);
	if (follower == null || followee == null) return "skip: user not found";

	// 申請が無ければ、取り消されたか承認済み（follow の削除は atprotoUnfollow の役目）
	if (!(await FollowRequests.exist({ where: { followerId: userId, followeeId: targetId } }))) {
		return "skip: no follow request";
	}

	const [identity, actor] = await Promise.all([
		AtprotoIdentities.findOneBy({ userId }),
		AtprotoActors.findOneBy({ userId: targetId }),
	]);
	if (!isUsableIdentity(identity) || actor == null) {
		await cancelFollowRequest(followee, follower);
		return "cancelled: no usable identity or actor";
	}

	// まだ書いていなければ follow を書く（やり直しのときは書いたものを使う）
	let map = await AtprotoRecordMaps.findOneBy({
		userId,
		collection: "app.bsky.graph.follow",
		followeeId: targetId,
	});
	if (map == null) {
		const written = await createFollowRecord(userId, actor.did);
		map = await saveRecordMap({
			uri: written.uri,
			cid: written.cid!,
			collection: "app.bsky.graph.follow",
			userId,
			noteId: null,
			followeeId: targetId,
		});
		logger.info(`Wrote a follow: ${identity.did} -> ${actor.did} (${written.uri})`);
	}

	// 相手側から見えるか（ブロックされていないか）を確かめる
	const rel = await fetchRelationship(actor.did, identity.did);
	if (rel?.blocking != null || rel?.blockingByList != null) {
		await cancelFollowRequest(followee, follower);
		return "cancelled: blocked by the followee";
	}
	if (rel?.followedBy === map.uri) {
		await acceptFollowRequest(followee, follower);
		logger.info(`Follow accepted: ${identity.did} -> ${actor.did}`);
		return "accepted";
	}

	// まだ見えない。最後の試行なら諦めて取り消す
	if (isLastAttempt(job)) {
		await cancelFollowRequest(followee, follower);
		logger.warn(`Gave up confirming a follow: ${identity.did} -> ${actor.did}`);
		return "cancelled: not visible from the followee";
	}
	throw new Error("the follow is not visible from the followee yet");
}

/**
 * `atprotoUnfollow` ジョブ: mkkey が書いた follow を消す。
 *
 * @remarks
 * - ジョブが動くまでの間にフォローし直されていたら（フォローか申請がある）、消さない。
 * - mkkey が書いたものでない follow（`createdByBridge` が false）は消さず、対応だけを消す。
 *
 * @param job - ジョブ
 * @returns 結果の説明（ジョブの記録用）
 * @throws 削除に失敗したとき（やり直させるため）
 * @internal
 */
async function unfollowJob(job: Bull.Job<AtprotoRecordJobData>): Promise<string> {
	const { userId, targetId } = job.data;

	const [following, requested] = await Promise.all([
		Followings.exist({ where: { followerId: userId, followeeId: targetId } }),
		FollowRequests.exist({ where: { followerId: userId, followeeId: targetId } }),
	]);
	if (following || requested) return "skip: followed again";

	const maps = await AtprotoRecordMaps.findBy({
		userId,
		collection: "app.bsky.graph.follow",
		followeeId: targetId,
	});
	return await deleteMappedRecords(userId, maps);
}

/**
 * `atprotoLike` ジョブ: Bluesky のノートへのリアクションを like として書く。
 *
 * @remarks
 * - ジョブが動くまでの間にリアクションが取り消されていたら、書かない。
 * - like の宛先（投稿の URI と CID）は、投稿を取り込んだときの対応表から引く。無ければ書けないので諦める。
 *
 * @param job - ジョブ
 * @returns 結果の説明（ジョブの記録用）
 * @throws 書き込みに失敗したとき（やり直させるため）
 * @internal
 */
async function likeJob(job: Bull.Job<AtprotoRecordJobData>): Promise<string> {
	const { userId, targetId: noteId } = job.data;

	if (!(await NoteReactions.exist({ where: { userId, noteId } }))) {
		return "skip: reaction removed";
	}
	if (
		await AtprotoRecordMaps.exist({
			where: { userId, collection: "app.bsky.feed.like", noteId },
		})
	) {
		return "skip: already liked";
	}

	const [identity, post] = await Promise.all([
		AtprotoIdentities.findOneBy({ userId }),
		AtprotoRecordMaps.findOneBy({ collection: "app.bsky.feed.post", noteId }),
	]);
	if (!isUsableIdentity(identity)) return "skip: no usable identity";
	if (post == null) return "skip: the post is not mapped";

	const written = await createLikeRecord(userId, { uri: post.uri, cid: post.cid });
	await saveRecordMap({
		uri: written.uri,
		cid: written.cid!,
		collection: "app.bsky.feed.like",
		userId,
		noteId,
		followeeId: null,
	});
	logger.info(`Wrote a like: ${identity.did} -> ${post.uri}`);
	return "liked";
}

/**
 * `atprotoUnlike` ジョブ: 書いた like を消す。
 *
 * @remarks
 * ジョブが動くまでの間にもう一度リアクションされていたら、消さない。
 *
 * @param job - ジョブ
 * @returns 結果の説明（ジョブの記録用）
 * @throws 削除に失敗したとき（やり直させるため）
 * @internal
 */
async function unlikeJob(job: Bull.Job<AtprotoRecordJobData>): Promise<string> {
	const { userId, targetId: noteId } = job.data;

	if (await NoteReactions.exist({ where: { userId, noteId } })) {
		return "skip: reacted again";
	}

	const maps = await AtprotoRecordMaps.findBy({
		userId,
		collection: "app.bsky.feed.like",
		noteId,
	});
	return await deleteMappedRecords(userId, maps);
}

// #endregion

/**
 * ジョブの処理を、結果の説明をログに残して何も返さない形（Bull の決まり）に包む。
 *
 * @param fn - 結果の説明を返す処理
 * @returns Bull に登録する処理
 * @internal
 */
function logResult(
	fn: (job: Bull.Job<AtprotoRecordJobData>) => Promise<string>,
): (job: Bull.Job<AtprotoRecordJobData>) => Promise<void> {
	return async (job) => {
		const result = await fn(job);
		logger.debug(`${job.name} ${job.id} (${job.data.userId} -> ${job.data.targetId}): ${result}`);
	};
}

/** `atprotoFollow` ジョブの処理（bg キューに登録する） @internal */
export const processFollowJob = logResult(followJob);
/** `atprotoUnfollow` ジョブの処理（bg キューに登録する） @internal */
export const processUnfollowJob = logResult(unfollowJob);
/** `atprotoLike` ジョブの処理（bg キューに登録する） @internal */
export const processLikeJob = logResult(likeJob);
/** `atprotoUnlike` ジョブの処理（bg キューに登録する） @internal */
export const processUnlikeJob = logResult(unlikeJob);

// #region 非公開ヘルパー

/**
 * 身元が、レコードを書ける状態か（有効・plc.directory に登録済み）。
 *
 * @param identity - 調べる身元
 * @returns 書ける状態なら true
 * @internal
 */
function isUsableIdentity(identity: AtprotoIdentity | null): identity is AtprotoIdentity {
	return identity != null && identity.status === "active" && identity.plcRegisteredAt != null;
}

/**
 * 24 時間のフォローの上限を 1 つ使う。
 *
 * @remarks
 * Redis の sorted set に、フォローした時刻を入れて数える（24 時間より前のものは捨てる）。
 * 数えてから足すまでの間に同時に来た分はすり抜けうるが、上限は「スパムのような量を止める」ためのものなので許す。
 *
 * @param userId - フォローするローカルユーザー
 * @throws 上限に達しているとき（{@link BLUESKY_FOLLOW_ERRORS.rateLimited}）
 * @internal
 */
async function consumeFollowQuota(userId: User["id"]): Promise<void> {
	const key = `atproto:followQuota:${userId}`;
	const now = Date.now();

	await redisClient.zremrangebyscore(key, 0, now - FOLLOW_QUOTA_WINDOW_MS);
	if ((await redisClient.zcard(key)) >= BLUESKY_FOLLOW_DAILY_LIMIT) {
		throw new IdentifiableError(
			BLUESKY_FOLLOW_ERRORS.rateLimited,
			`you can follow up to ${BLUESKY_FOLLOW_DAILY_LIMIT} Bluesky users per 24 hours`,
		);
	}
	await redisClient.zadd(key, now, `${now}:${genId()}`);
	await redisClient.pexpire(key, FOLLOW_QUOTA_WINDOW_MS);
}

/**
 * 書いたレコードと mkkey のデータの対応を保存する。
 *
 * @param row - 保存する中身（ID と作成日時はここで付ける）
 * @returns 保存した行
 * @internal
 */
async function saveRecordMap(row: {
	uri: string;
	cid: string;
	collection: "app.bsky.graph.follow" | "app.bsky.feed.like";
	userId: User["id"];
	noteId: Note["id"] | null;
	followeeId: User["id"] | null;
}) {
	return await AtprotoRecordMaps.save({
		id: genId(),
		createdAt: new Date(),
		createdByBridge: true,
		...row,
	});
}

/**
 * 対応表にあるレコードを消し、対応も消す。
 *
 * @remarks
 * - mkkey が書いたもの（`createdByBridge`）だけを PDS から消す。
 * - PDS にもう無いレコード（前のジョブで消し終わっていた）は、対応だけを消す。
 * - 身元が使えない（止めた）ときは、PDS には書けないので対応だけを消す。
 *   NOTE: 身元を止めたときにレコードを消す処理は、身元の停止の側で扱う（`identity.ts` の TODO）。
 *
 * @param userId - レコードの持ち主
 * @param maps - 消す対応
 * @returns 結果の説明（ジョブの記録用）
 * @throws PDS からの削除に失敗したとき
 * @internal
 */
async function deleteMappedRecords(
	userId: User["id"],
	maps: { id: string; uri: string; createdByBridge: boolean }[],
): Promise<string> {
	if (maps.length === 0) return "skip: nothing to delete";

	const identity = await AtprotoIdentities.findOneBy({ userId });
	for (const map of maps) {
		if (map.createdByBridge && isUsableIdentity(identity)) {
			try {
				await deleteBridgeRecord(identity, map.uri);
			} catch (err) {
				// 前の試行で消し終わっていたものは、対応だけ消せばよい
				if (!String(err).includes("record not found")) throw err;
			}
		}
		await AtprotoRecordMaps.delete(map.id);
	}
	return `deleted ${maps.length}`;
}

/**
 * ジョブが最後の試行か。
 *
 * @param job - ジョブ
 * @returns この試行で失敗したら、もうやり直さないなら true
 * @internal
 */
function isLastAttempt(job: Bull.Job): boolean {
	return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

// #endregion
