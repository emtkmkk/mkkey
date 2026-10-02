/**
 * @packageDocumentation
 *
 * mkkey のローカルユーザーに、Bluesky ブリッジ用の身元（DID:plc・ハンドル・鍵）を発行・停止する。
 *
 * @remarks
 * - 身元はオプトインした人にだけ作る。今は管理者用 API（`admin/atproto/*`）からだけ呼ぶ。
 *   TODO: ユーザー設定の画面からオプトインできるようにする（実装手順 12）
 * - 発行の順番: 鍵を作る → データベースに保存する → plc.directory に登録する。
 *   先に保存するのは、登録だけ成功して鍵を失う（＝二度と操作できない DID ができる）のを避けるため。
 *   登録に失敗したら `plcRegisteredAt` が null のまま残り、もう一度呼べば登録し直す。
 * - 有効にしたら、firehose に `#identity` と `#account`（使える）を流し、レポジトリが無ければプロフィールだけの最初のコミットを作る。
 * - 停止は `status` を deactivated にして、firehose に `#account`（止めた）を流すだけ。DID は残す。
 *   もう一度有効にすれば同じ DID とハンドルに戻る。
 *   TODO: 停止したときに、書いた follow / like を消す（実装手順 8 の記録ジョブができてから）
 *
 * @see {@link ./plc.ts} PLC の操作
 * @see {@link ../../models/entities/atproto-identity.ts} 保存先
 * @internal
 */

import { Secp256k1Keypair } from "@atproto/crypto";
import type { User } from "@/models/entities/user.js";
import type { AtprotoIdentity } from "@/models/entities/atproto-identity.js";
import { AtprotoIdentities } from "@/models/index.js";
import { remoteLogger } from "../logger.js";
import { getAtprotoConfig } from "./config.js";
import {
	createGenesisOperation,
	isPlcRegistered,
	submitPlcOperation,
} from "./plc.js";
import { ensureRepo, upsertProfile } from "./repo.js";
import { emitAccountEvent, emitIdentityEvent } from "./sequencer.js";

/** このモジュールのログ */
const logger = remoteLogger.createSubLogger("atproto", "cyan");

// #region ハンドル

/** ハンドルの 1 区切り（ラベル）として使える形。英小文字・数字・`-` で、先頭と末尾は `-` 以外 */
const HANDLE_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * ローカルユーザーのハンドルを決める。
 *
 * @remarks
 * - 基本は username を小文字にして、`_` を `-` に置き換える（ハンドルに `_` は使えないため）。
 *   例: `Alice_Bob` → `alice-bob.bsky.mkkey.net`
 * - mkkey の username には `-` が無いので、置き換えても他人のハンドルとはぶつからない。
 * - 先頭か末尾が `_` の人（`_alice` など）は、置き換えると `-` で始まって使えない。
 *   その人だけ `u-<ユーザー ID>` にする。例: `u-9x1pfqrtic.bsky.mkkey.net`
 * - NB: mkkey の username は変えられないので、ハンドルも変わらない前提でよい。
 *
 * @param user - 対象のローカルユーザー（`id` と `username` を使う）
 * @returns ハンドル（小文字）
 * @internal
 */
export function toPdsHandle(user: Pick<User, "id" | "username">): string {
	const { pdsHostname } = getAtprotoConfig();
	const label = user.username.toLowerCase().replace(/_/g, "-");

	// 使えない形なら、ユーザー ID から作った形に切り替える
	const safeLabel = HANDLE_LABEL_PATTERN.test(label)
		? label
		: `u-${user.id.toLowerCase()}`;

	return `${safeLabel}.${pdsHostname}`;
}

// #endregion

// #region 公開メソッド

/**
 * ローカルユーザーの身元を有効にする（無ければ発行する）。
 *
 * @remarks
 * - 何度呼んでもよい。すでに有効で登録済みなら、何もせずに今の身元を返す。
 * - plc.directory への登録に失敗したら例外にする。その場合も身元はデータベースに残り、もう一度呼べば登録し直す。
 *
 * @param user - 対象のローカルユーザー
 * @returns 有効になった身元
 * @throws ブリッジが無効なとき、対象がローカルユーザーでない・凍結されている・削除済みのとき
 * @throws 保存済みの鍵から作り直した DID が、保存済みの DID と違うとき（鍵やハンドルの設定が変わった）
 * @throws plc.directory への登録に失敗したとき
 * @internal
 */
export async function enableAtprotoIdentity(
	user: Pick<
		User,
		| "id"
		| "username"
		| "name"
		| "avatarId"
		| "bannerId"
		| "host"
		| "isSuspended"
		| "isDeleted"
	>,
): Promise<AtprotoIdentity> {
	assertEnabled();

	// #region 入力チェック
	if (user.host != null) throw new Error("only local users can be bridged");
	if (user.isSuspended) throw new Error("the user is suspended");
	if (user.isDeleted) throw new Error("the user is deleted");
	// #endregion

	// まだ身元が無ければ、鍵を作ってデータベースに保存する（登録より先に保存する）
	let identity = await AtprotoIdentities.findOneBy({ userId: user.id });
	if (identity == null) {
		identity = await createIdentityRow(user);
	}

	// 新しく登録した・再開したときだけ、firehose で Relay に知らせる
	let becameActive = false;

	// plc.directory に未登録なら登録する
	if (identity.plcRegisteredAt == null) {
		await registerToPlc(identity);
		identity.plcRegisteredAt = new Date();
		await AtprotoIdentities.update(identity.userId, {
			plcRegisteredAt: identity.plcRegisteredAt,
			updatedAt: new Date(),
		});
		becameActive = true;
	}

	// 停止していたら再開する
	if (identity.status !== "active") {
		identity.status = "active";
		await AtprotoIdentities.update(identity.userId, {
			status: "active",
			updatedAt: new Date(),
		});
		becameActive = true;
	}

	if (becameActive) {
		await emitIdentityEvent(identity.did, identity.handle);
		await emitAccountEvent(identity.did, true);
	}

	// レポジトリがまだ無ければ、プロフィールだけの最初のコミットを作る（失敗しても、もう一度呼べば作り直す）
	await ensureRepo(identity, user);

	return identity;
}

/**
 * ローカルユーザーの身元を止める。
 *
 * @remarks
 * - DID と鍵は残す（もう一度有効にすれば元に戻る）。身元が無ければ何もしない。
 * - firehose に `#account`（止めた）を流す。Relay はこれを見て、このアカウントの中身を配らなくなる。
 * - TODO: 書いた follow / like を消す処理は、記録ジョブができてから足す（実装手順 8）。
 *
 * @param user - 対象のローカルユーザー
 * @returns 止めた身元。もともと無ければ null
 * @internal
 */
export async function disableAtprotoIdentity(
	user: Pick<User, "id">,
): Promise<AtprotoIdentity | null> {
	const identity = await AtprotoIdentities.findOneBy({ userId: user.id });
	if (identity == null) return null;

	// すでに止まっていれば、書き込まずにそのまま返す
	if (identity.status === "deactivated") return identity;

	identity.status = "deactivated";
	await AtprotoIdentities.update(identity.userId, {
		status: "deactivated",
		updatedAt: new Date(),
	});

	// plc.directory に登録済みのときだけ知らせる（未登録なら Relay はこの DID を知らない）
	if (identity.plcRegisteredAt != null) {
		await emitAccountEvent(identity.did, false);
	}
	return identity;
}

/**
 * mkkey 側のプロフィールの変更を、Bluesky のプロフィールに反映する。
 *
 * @remarks
 * - mkkey のプロフィール更新（`services/i/update.ts` の `publishToFollowers`）から、待たずに呼ばれる。
 * - 身元が無い・止まっている・まだレポジトリが無いユーザーでは何もしない。オプトインしていない人がほとんどなので、
 *   その場合は身元を 1 回引くだけで終わる。
 * - 表示名・アイコン・バナーが変わっていなければ書かない（{@link upsertProfile}）。
 * - 失敗はログに残すだけにする。プロフィールの保存そのものは済んでいて、利用者に返すエラーが無いため。
 *   次にプロフィールを更新したとき、または `admin/atproto/refresh-profile` で書き直せる。
 *
 * @param user - 対象のローカルユーザー
 * @internal
 */
export async function syncAtprotoProfile(
	user: Pick<User, "id" | "username" | "name" | "avatarId" | "bannerId">,
): Promise<void> {
	if (!getAtprotoConfig().enabled) return;

	const identity = await AtprotoIdentities.findOneBy({ userId: user.id });
	if (
		identity == null ||
		identity.status !== "active" ||
		identity.plcRegisteredAt == null ||
		identity.repoCommitCid == null
	) {
		return;
	}

	try {
		const commit = await upsertProfile(identity, user);
		if (commit != null) {
			logger.info(`Updated the Bluesky profile of ${identity.handle} (rev ${commit.rev})`);
		}
	} catch (err) {
		logger.warn(`Failed to update the Bluesky profile of ${identity.handle}: ${err}`);
	}
}

/**
 * 身元を、管理者用 API で返す形にする。
 *
 * @remarks
 * WARNING: 秘密鍵（`signingPrivateKey` / `rotationPrivateKey`）を返さないため、必ずこれを通して返すこと。
 * 身元の行をそのまま API で返してはいけない。
 *
 * @param identity - 対象の身元
 * @returns 秘密鍵を除いた情報
 * @internal
 */
export function packAtprotoIdentityForAdmin(identity: AtprotoIdentity) {
	return {
		userId: identity.userId,
		did: identity.did,
		handle: identity.handle,
		status: identity.status,
		plcRegisteredAt: identity.plcRegisteredAt?.toISOString() ?? null,
		repoRev: identity.repoRev,
		createdAt: identity.createdAt.toISOString(),
		updatedAt: identity.updatedAt.toISOString(),
	};
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
 * 鍵を作り、DID を計算して、身元の行を保存する。plc.directory にはまだ送らない。
 *
 * @param user - 対象のローカルユーザー
 * @returns 保存した身元（`plcRegisteredAt` は null）
 * @internal
 */
async function createIdentityRow(
	user: Pick<User, "id" | "username">,
): Promise<AtprotoIdentity> {
	// 署名用と PLC 用で、別々の鍵を作る（片方が漏れても、もう片方で立て直せるように）
	const signingKey = await Secp256k1Keypair.create({ exportable: true });
	const rotationKey = await Secp256k1Keypair.create({ exportable: true });
	const handle = toPdsHandle(user);

	const { did } = await createGenesisOperation({
		signingKey,
		rotationKey,
		handle,
	});

	const now = new Date();
	const identity: AtprotoIdentity = {
		userId: user.id,
		user: null,
		did,
		handle,
		status: "active",
		signingPrivateKey: Buffer.from(await signingKey.export()).toString("hex"),
		rotationPrivateKey: Buffer.from(await rotationKey.export()).toString(
			"hex",
		),
		repoRev: null,
		repoCommitCid: null,
		createdAt: now,
		updatedAt: now,
		plcRegisteredAt: null,
	};

	// user は関連の入れ物なので、保存する値からは外す
	const { user: _user, ...row } = identity;
	await AtprotoIdentities.insert(row);

	// NB: DID は公開される値なので出してよい。鍵は絶対にログに出さない
	logger.info(`created identity: userId=${user.id} did=${did} handle=${handle}`);
	return identity;
}

/**
 * 保存済みの鍵から最初の操作を作り直し、plc.directory に登録する。
 *
 * @remarks
 * - 作り直した DID が保存済みの DID と違えば送らない。ハンドルや `pdsHostname` の設定が、
 *   発行したときから変わっていると起きる。そのまま送ると、別の DID ができてしまうため。
 * - 前回「送ったが応答を受け取れなかった」場合に備えて、送る前に登録済みかを確かめる。
 *
 * @param identity - 対象の身元
 * @throws 作り直した DID が保存済みの DID と違うとき
 * @throws plc.directory への問い合わせや登録に失敗したとき
 * @internal
 */
async function registerToPlc(identity: AtprotoIdentity): Promise<void> {
	const signingKey = await Secp256k1Keypair.import(identity.signingPrivateKey);
	const rotationKey = await Secp256k1Keypair.import(
		identity.rotationPrivateKey,
	);

	const { op, did } = await createGenesisOperation({
		signingKey,
		rotationKey,
		handle: identity.handle,
	});

	if (did !== identity.did) {
		throw new Error(
			`rebuilt DID does not match the stored one (stored=${identity.did}, rebuilt=${did}). Did atproto.pdsHostname change?`,
		);
	}

	// 実は登録済みなら、送らずに済ませる
	if (await isPlcRegistered(did)) {
		logger.info(`already registered to PLC: ${did}`);
		return;
	}

	await submitPlcOperation(did, op);
	logger.succ(`registered to PLC: ${did}`);
}

// #endregion
