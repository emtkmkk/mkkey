/**
 * @packageDocumentation
 *
 * 同じ `@名前@ホスト` なのに URI（アクターの id）が違う人が来たときの扱い。
 *
 * @remarks
 * - ActivityPub で人を表すのは URI で、ユーザー名（`preferredUsername`）は仕様上一意とは限らない。
 *   一方このサーバーは `(usernameLower, host)` を一意にしているので、同じ名前で URI が違う人が来ると登録できない。
 * - 起きる例（本番で確認、2026-11）:
 *   - 相手のソフトがアクターの ID の形を変えた（WordPress の ActivityPub プラグインで `?author=4` → `/@名前`）
 *   - 相手のサーバーが同じドメインのまま作り直された（Misskey 系で、同じ名前の ID が変わった）
 * - 方針:
 *   1. WebFinger で、その名前が今どの URI を指しているか確かめる。新しい URI を指していなければ何もしない
 *      （相手の設定ミスや、別の URI を名乗る偽物を通さないため）
 *   2. 同じ人だと確かめられたら（{@link isSameActor}）、古い行の URI を付け直す。
 *      フォロー関係・ミュート・投稿などがそのまま引き継がれる
 *   3. 確かめられなければ、古い行の名前に印を付けて空け（{@link freeAcct}）、新しい人は新しい行として登録する。
 *      別の人に前の人の投稿やブロックが引き継がれないようにするため
 *
 * @see {@link createPerson} 登録時のぶつかり
 * @see {@link remote/resolve-user} `@名前@ホスト` から取り直すときの食い違い
 * @internal
 */
import { Users, UserPublickeys } from "@/models/index.js";
import type { User } from "@/models/entities/user.js";
import { publishInternalEvent } from "@/services/stream.js";
import webFinger from "@/remote/webfinger.js";
import { apLogger } from "../logger.js";
import type { IActor } from "../type.js";

const logger = apLogger;

/**
 * ぶつかりを処理した結果。
 *
 * - `repointed`: 同じ人なので、古い行の URI を新しい URI に付け直した
 * - `freed`: 別の人かもしれないので、古い行の名前を空けた（新しい行として登録してよい）
 * - `none`: 何もしなかった（ぶつかっていない、または WebFinger が新しい URI を指していない）
 *
 * @internal
 */
export type AcctCollisionOutcome = "repointed" | "freed" | "none";

/**
 * 新しいアクターと同じ `@名前@ホスト` を持つ古い行があれば、付け直すか名前を空ける。
 *
 * @param person - 新しく来たアクター（検証済み）
 * @param host - 相手のホスト（puny 済み）
 * @returns 何をしたか
 *
 * @remarks
 * 呼び出し側は、`repointed` なら付け直した行を {@link updatePerson} で更新し、
 * `freed` なら新しい行として登録をやり直す。`none` なら今までどおり登録しない。
 *
 * @internal
 */
export async function resolveAcctCollision(
	person: IActor,
	host: string,
): Promise<AcctCollisionOutcome> {
	const usernameLower = person.preferredUsername?.toLowerCase();
	if (!usernameLower || !person.id) return "none";

	const existing = await Users.findOneBy({ usernameLower, host });
	if (existing == null || existing.uri === person.id) return "none";

	if (!(await acctPointsTo(`${usernameLower}@${host}`, person.id))) {
		logger.info(
			`acct collision ignored (WebFinger does not point to new uri): ${person.id}`,
		);
		return "none";
	}

	if (await isSameActor(existing, person)) {
		await Users.update(existing.id, { uri: person.id });
		publishInternalEvent("remoteUserUpdated", { id: existing.id });
		logger.info(`acct collision: repointed ${existing.uri} -> ${person.id}`);
		return "repointed";
	}

	await freeAcct(existing, usernameLower);
	logger.info(`acct collision: freed ${existing.uri} for ${person.id}`);
	return "freed";
}

/**
 * 古い行と新しいアクターが同じ人だと言えるか。
 *
 * @param existing - 同じ名前の古い行
 * @param person - 新しく来たアクター
 * @returns 新しいアクターの `alsoKnownAs` に古い URI があるか、公開鍵が同じなら true
 *
 * @remarks
 * どちらも、新しいアクターの持ち主が古いアクターと同じだと示す手がかり。
 * ID の形だけ変えた場合は鍵が変わらないことが多い。サーバーを作り直した場合は鍵も変わるので false になる。
 *
 * @internal
 */
export async function isSameActor(
	existing: Pick<User, "id" | "uri">,
	person: IActor,
): Promise<boolean> {
	if (existing.uri != null && (person.alsoKnownAs ?? []).includes(existing.uri)) {
		return true;
	}

	const newPem = person.publicKey?.publicKeyPem;
	if (!newPem) return false;
	const oldKey = await UserPublickeys.findOneBy({ userId: existing.id });
	return oldKey != null && normalizePem(oldKey.keyPem) === normalizePem(newPem);
}

/**
 * 古い行の `usernameLower` に印を付けて、その名前を新しい人のために空ける。
 *
 * @param existing - 名前を空ける古い行
 * @param usernameLower - 今の `usernameLower`
 * @returns 書き換えが終わった時点で解決する Promise
 *
 * @remarks
 * - 表示名（`username`）は変えない。古い投稿の作者表示は今のまま残る。
 * - 印は `#replaced-<行の ID>` を付ける。`#` はユーザー名に使われない文字なので、本物の名前とはぶつからない。
 *   列の長さ（128）に収まるよう、名前の側を切り詰める。
 * - `@名前@ホスト` で引くと新しい人が見つかるようになり、古い行は URI でだけ引ける。
 *
 * @internal
 */
export async function freeAcct(
	existing: Pick<User, "id">,
	usernameLower: string,
): Promise<void> {
	const suffix = `#replaced-${existing.id}`;
	const freed = `${usernameLower.slice(0, 128 - suffix.length)}${suffix}`;
	await Users.update(existing.id, { usernameLower: freed });
	publishInternalEvent("remoteUserUpdated", { id: existing.id });
}

/**
 * WebFinger で、`acct` が今 `uri` を指しているか確かめる。
 *
 * @param acct - `名前@ホスト`（小文字・puny 済み）
 * @param uri - 指していてほしい URI
 * @returns 指していれば true。WebFinger に失敗したときは false
 *
 * @internal
 */
async function acctPointsTo(acct: string, uri: string): Promise<boolean> {
	try {
		const finger = await webFinger(acct);
		const self = finger.links.find(
			(link) => link.rel != null && link.rel.toLowerCase() === "self",
		);
		return self?.href === uri;
	} catch (e) {
		logger.debug(`WebFinger failed for ${acct}: ${e}`);
		return false;
	}
}

/**
 * 公開鍵の PEM を比べられる形にする（改行や前後の空白の違いを無視する）。
 *
 * @param pem - 公開鍵の PEM
 * @returns 空白を取り除いた文字列
 *
 * @internal
 */
function normalizePem(pem: string): string {
	return pem.replace(/\s+/g, "");
}
