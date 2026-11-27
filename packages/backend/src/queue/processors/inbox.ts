/**
 * @packageDocumentation
 *
 * ActivityPub Inbox ジョブ。署名検証・ブロック判定・Activity 種別に応じた処理を行う。
 *
 * @remarks
 * - **役割**: inbox キューで実行。受信した Activity の署名検証・ブロック判定のうえ、perform で種別ごとに処理する。
 * - 署名の検証が済んだ受信は、送り元のサーバが動いている証拠として健康状態の層に伝える
 *   （{@link noteHostAlive}。自動停止・閉鎖停止はここで解除される）。
 *
 * - 削除済み（論理削除）の人からの受信は、相手のサーバーでまだ存在すると確かめられたときだけ処理する
 *   （{@link reviveDeletedActor}）。公開鍵が DB に残っているので、署名の検証だけでは弾けないため。
 *
 * @see {@link perform} Activity 処理
 * @see {@link activitypub} inbox 投入元
 * @internal
 */
import { URL } from "node:url";
import type Bull from "bull";
import httpSignature from "@peertube/http-signature";
import perform from "@/remote/activitypub/perform.js";
import Logger from "@/services/logger.js";
import { registerOrFetchInstanceDoc } from "@/services/register-or-fetch-instance-doc.js";
import { Instances, Users } from "@/models/index.js";
import {
	apRequestChart,
	federationChart,
	instanceChart,
} from "@/services/chart/index.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { toPuny, extractDbHost } from "@/misc/convert-host.js";
import { getApId } from "@/remote/activitypub/type.js";
import { fetchInstanceMetadata } from "@/services/fetch-instance-metadata.js";
import type { InboxJobData } from "../types.js";
import DbResolver from "@/remote/activitypub/db-resolver.js";
import { resolvePerson, updatePerson } from "@/remote/activitypub/models/person.js";
import { LdSignature } from "@/remote/activitypub/misc/ld-signature.js";
import { StatusError } from "@/misc/fetch.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import type { UserPublickey } from "@/models/entities/user-publickey.js";
import { shouldBlockInstance } from "@/misc/should-block-instance.js";
import { verifySignature } from "@/remote/activitypub/check-fetch.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import { noteHostAlive, shouldWriteStats } from "@/services/instance-health/state.js";

const logger = new Logger("inbox");

/**
 * 再送しても結果が変わらないので、再送せずに終わらせる IdentifiableError の ID。
 *
 * @remarks
 * 追加するときは「時間がたっても状態が変わらない」ことを確かめる。
 * 例: 相手からのリアクション取り消しで、こちらにそのリアクションが無い場合は、何度試しても無いまま。
 *
 * @internal
 */
const nonRetryableIdentifiableErrorIds = new Set([
	"639cc3a5-fe68-b071-0c20-413c887054cd", // deleted note reaction
	"119b8757-2ba5-385e-82cf-7fa4bc73c4d1", // muted reaction rejected
	"8884c2dd-5795-4ac9-b27e-6a01d38190f9", // duplicated Accept without follow request
	// 見られない投稿（公開範囲の外）へのリアクション。本番で 3 日に 96 件、毎回 8 回まで再送されていた
	"68e9d2d1-48bf-42c2-b90a-b20e09fd3d48", // Note not accessible for you.
	// 存在しないリアクションの取り消し。本番で 3 日に 19 件
	"60527ec9-b4cb-4a88-a6bd-32d3ad26817d", // not reacted
]);

/**
 * inbox の処理で投げられた例外が、再送せずに終わらせてよいものかを判定する。
 *
 * @param error - Activity の処理で投げられた例外
 * @returns 再送しても結果が変わらないなら true
 * @internal
 */
function isNonRetryableInboxError(error: unknown): boolean {
	if (error instanceof StatusError) return !error.isRetryable;

	if (error instanceof IdentifiableError) {
		if (nonRetryableIdentifiableErrorIds.has(error.id)) return true;
		return !error.isRetryable;
	}

	return false;
}

// ユーザーの inbox に Activity が届いたときの処理
export default async (job: Bull.Job<InboxJobData>): Promise<string> => {
	const signature = job.data.signature; // HTTP 署名
	let activity = job.data.activity;

	//#region ログ
	const info = Object.assign({}, activity) as any;
	info["@context"] = undefined;
	logger.debug(JSON.stringify(info, null, 2));
	job.log("debug - " + JSON.stringify(info, null, 2));

	if (!signature?.keyId) {
		const err = `Invalid signature: ${signature}`;
		job.moveToFailed({ message: err });
		return err;
	}
	//#endregion
	const host = toPuny(new URL(signature.keyId).hostname);

	// ブロック済みならここで終了
	const meta = await fetchMeta();
	if (await shouldBlockInstance(host, meta)) {
		return `Blocked request: ${host}`;
	}

	// プライベートモードでは許可リストのインスタンスのみ
	if (meta.privateMode && !meta.allowedHosts.includes(host)) {
		return `Blocked request: ${host}`;
	}

	const keyIdLower = signature.keyId.toLowerCase();
	if (keyIdLower.startsWith("acct:")) {
		return `Old keyId is no longer supported. ${keyIdLower}`;
	}

	const dbResolver = new DbResolver();

	// HTTP-Signature keyId from DB
	let authUser: {
		user: CacheableRemoteUser;
		key: UserPublickey | null;
	} | null = await dbResolver.getAuthUserFromKeyId(signature.keyId);

	// keyIdでわからなければ、activity.actorを元にDBから取得 || activity.actorを元にリモートから取得
	if (authUser == null) {
		try {
			authUser = await dbResolver.getAuthUserFromApId(getApId(activity.actor));
		} catch (e) {
			// Skip if target is 4xx
			if (e instanceof StatusError) {
				if (!e.isRetryable) {
					return `skip: Ignored deleted actors on both ends ${activity.actor} - ${e.statusCode}`;
				}
				throw new Error(
					`Error in actor ${activity.actor} - ${e.statusCode || e}`,
				);
			}
		}
	}

	// それでもわからなければ終了
	if (authUser == null) {
		return "skip: failed to resolve user";
	}

	// publicKey がなくても終了
	if (authUser.key == null) {
		return "skip: failed to resolve user publicKey";
	}

	// HTTP-Signatureの検証
	let httpSignatureValidated = httpSignature.verifySignature(
		signature,
		authUser.key.keyPem,
	);

	// If signature validation failed, try refetching the actor
	if (!httpSignatureValidated) {
		authUser.key = await dbResolver.refetchPublicKeyForApId(authUser.user);

		if (authUser.key == null) {
			return "skip: failed to re-resolve user publicKey";
		}

		httpSignatureValidated = httpSignature.verifySignature(
			signature,
			authUser.key.keyPem,
		);
	}

	if (httpSignatureValidated) {
		if (!verifySignature(signature, authUser.key))
			return `skip: Invalid HTTP signature`;
	}

	// また、signatureのsignerは、activity.actorと一致する必要がある
	if (!httpSignatureValidated || authUser.user.uri !== activity.actor) {
		// 一致しなくても、でもLD-Signatureがありそうならそっちも見る
		if (activity.signature) {
			if (activity.signature.type !== "RsaSignature2017") {
				return `skip: unsupported LD-signature type ${activity.signature.type}`;
			}

			// activity.signature.creator: https://example.oom/users/user#main-key
			// みたいになっててUserを引っ張れば公開キーも入ることを期待する
			if (activity.signature.creator) {
				const candicate = activity.signature.creator.replace(/#.*/, "");
				await resolvePerson(candicate).catch(() => null);
			}

			// keyIdからLD-Signatureのユーザーを取得
			authUser = await dbResolver.getAuthUserFromKeyId(
				activity.signature.creator,
			);
			if (authUser == null) {
				return "skip: LD-Signatureのユーザーが取得できませんでした";
			}

			if (authUser.key == null) {
				return "skip: LD-SignatureのユーザーはpublicKeyを持っていませんでした";
			}

			// LD-Signature検証
			const ldSignature = new LdSignature();
			const verified = await ldSignature
				.verifyRsaSignature2017(activity, authUser.key.keyPem)
				.catch(() => false);
			if (!verified) {
				return "skip: LD-Signatureの検証に失敗しました";
			}

			activity = await ldSignature.compactToWellKnown(activity);

			// もう一度actorチェック
			if (authUser.user.uri !== activity.actor) {
				return `skip: LD-Signature user(${authUser.user.uri}) !== activity.actor(${activity.actor})`;
			}

			// ブロックしてたら中断
			const ldHost = extractDbHost(authUser.user.uri);
			if (await shouldBlockInstance(ldHost, meta)) {
				return `Blocked request: ${ldHost}`;
			}
		} else {
			return `skip: http-signature verification failed and no LD-Signature. keyId=${signature.keyId}`;
		}
	}

	// activity.idがあればホストが署名者のホストであることを確認する
	if (typeof activity.id === "string") {
		const signerHost = extractDbHost(authUser.user.uri!);
		const activityIdHost = extractDbHost(activity.id);
		if (signerHost !== activityIdHost) {
			return `skip: signerHost(${signerHost}) !== activity.id host(${activityIdHost}`;
		}
	}
	job.progress(25);

	// 署名の検証済みの受信 = 相手のサーバが動いている。不通の記録を消し、自動停止・閉鎖停止を解除する（手動停止は解除しない）
	const senderHost = authUser.user.host;
	if (senderHost != null) {
		noteHostAlive(senderHost, "inbox", {
			activityType: activity.type,
			activityId: typeof activity.id === "string" ? activity.id : null,
		}).catch((e) => logger.warn(`failed to record health of ${senderHost}: ${e}`));
	}

	// 統計を更新（チャートは毎回、instance 行はホストごとに 1 分に 1 回だけ書く）
	registerOrFetchInstanceDoc(authUser.user.host).then((i) => {
		if (shouldWriteStats(i.host, "received")) {
			Instances.update(i.id, {
				latestRequestReceivedAt: new Date(),
				lastCommunicatedAt: new Date(),
			});
		}

		fetchInstanceMetadata(i);

		instanceChart.requestReceived(i.host);
		apRequestChart.inbox();
		federationChart.inbox(i.host);
	});
	job.progress(50);

	// 削除済みの人からの受信は、相手のサーバーで本当にまだ存在すると確かめられたときだけ処理する
	if (authUser.user.isDeleted) {
		const revived = await reviveDeletedActor(authUser.user);
		if (revived == null) {
			return `skip: actor is deleted ${authUser.user.uri}`;
		}
		authUser.user = revived;
	}

	// アクティビティを処理
	try {
		await perform(authUser.user, activity, job.data.user?.id);
	} catch (error) {
		if (isNonRetryableInboxError(error)) {
			if (error instanceof Error) {
				return `skip: non retryable inbox error ${error.message}`;
			}
			return "skip: non retryable inbox error";
		}
		throw error;
	}

	job.progress(100);
	return "ok";
};

/**
 * 削除済みの人を取り直す間隔（ミリ秒）。
 *
 * @internal
 */
const REVIVE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24;

/**
 * 削除済みのリモートの人を取り直し、相手のサーバーでまだ存在すれば復活させる。
 *
 * @param user - 削除済みのリモートユーザー
 * @returns 復活したユーザー。存在を確かめられなかったときは null（届いたものは捨てる）
 *
 * @remarks
 * - 論理削除に変える前は、削除した人の行が無いので受信のたびに相手へ取りに行き、
 *   410 Gone などで失敗して終わっていた。それと同じ結果になるよう、取り直しに成功したときだけ処理する。
 * - 復活は {@link updatePerson} が `isDeleted: false` を書くことで起きる。届いた Update の中身では復活させず、
 *   必ず相手のサーバーから取り直す（Delete の前に送られた Update が後から届いても、復活しないようにするため）。
 * - 取り直しは 1 人につき 1 日 1 回まで。消えた相手へ受信のたびに問い合わせないよう、
 *   取りに行く前に `lastFetchedAt` を進める。
 *
 * @internal
 */
async function reviveDeletedActor(
	user: CacheableRemoteUser,
): Promise<CacheableRemoteUser | null> {
	const current = await Users.findOneBy({ id: user.id });
	if (current == null || !current.isDeleted) {
		// 別の受信が先に復活させていれば、それを使う
		return (current as CacheableRemoteUser | null) ?? null;
	}

	// 取り直す先が無いか、最近取り直したばかりなら、確かめずに捨てる
	if (
		current.uri == null ||
		(current.lastFetchedAt != null &&
			Date.now() - current.lastFetchedAt.getTime() < REVIVE_CHECK_INTERVAL_MS)
	) {
		return null;
	}
	await Users.update(user.id, { lastFetchedAt: new Date() });

	try {
		// hint を渡さず、相手のサーバーから取り直す
		await updatePerson(current.uri);
	} catch (e) {
		logger.debug(`deleted actor is still gone: ${user.uri} ${e}`);
		return null;
	}

	const revived = await Users.findOneBy({ id: user.id });
	if (revived == null || revived.isDeleted) return null;
	logger.info(`revived deleted actor: ${user.uri}`);
	return revived as CacheableRemoteUser;
}
