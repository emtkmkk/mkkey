/**
 * @packageDocumentation
 *
 * リモートユーザを username@host から解決する。WebFinger / createPerson・updatePerson 経由で HTTP を行う。
 *
 * @remarks
 * - **役割**: フォロー・メンション等で username@host からリモートユーザーを取得・登録する。
 * - **並行制御**: リモート解決は acct 単位のインフライト結合で重複 resync を抑える（{@link remote/resolve-user-inflight}）。
 *
 * @see {@link remote/activitypub/models/person} Person 作成・更新
 * @internal
 */
import { URL } from "node:url";
import chalk from "chalk";
import { IsNull } from "typeorm";
import config from "@/config/index.js";
import type { User, IRemoteUser } from "@/models/entities/user.js";
import { Users } from "@/models/index.js";
import { toPuny } from "@/misc/convert-host.js";
import webFinger from "./webfinger.js";
import { createPerson, updatePerson } from "./activitypub/models/person.js";
import Resolver from "./activitypub/resolver.js";
import {
	buildResolveUserInflightKey,
	withResolveUserInflight,
} from "./resolve-user-inflight.js";
import { remoteLogger } from "./logger.js";

const logger = remoteLogger.createSubLogger("resolve-user");

/** リモートユーザー情報の再取得間隔（24 時間） */
const RESYNC_INTERVAL_MS = 1000 * 60 * 60 * 24;

/**
 * リモートユーザを username@host から解決する。
 *
 * @remarks
 * HTTP は webFinger / createPerson・updatePerson 経由で行い、person 側で timeout 等を設定している。
 * ローカルユーザー判定後、リモート経路のみインフライト結合する。
 *
 * @param username - ユーザー名
 * @param host - ホスト（ローカルの場合は null）
 * @returns 解決されたユーザー
 * @public
 */
export async function resolveUser(
	username: string,
	host: string | null,
): Promise<User> {
	const usernameLower = username.toLowerCase();

	if (host == null) {
		logger.info(`return local user: ${usernameLower}`);
		return await Users.findOneBy({ usernameLower, host: IsNull() }).then(
			(u) => {
				if (u == null) {
					throw new Error("user not found");
				} else {
					return u;
				}
			},
		);
	}

	const punyHost = toPuny(host);

	if (config.host === punyHost) {
		logger.info(`return local user: ${usernameLower}`);
		return await Users.findOneBy({ usernameLower, host: IsNull() }).then(
			(u) => {
				if (u == null) {
					throw new Error("user not found");
				} else {
					return u;
				}
			},
		);
	}

	const acctKey = buildResolveUserInflightKey(usernameLower, punyHost);
	return await withResolveUserInflight(acctKey, () =>
		resolveRemoteUser(username, usernameLower, punyHost),
	);
}

/**
 * リモートホスト上のユーザーを解決する（インフライト結合の内側で実行される）。
 *
 * @param username - 元のユーザー名（ログ用）
 * @param usernameLower - 小文字化済みユーザー名
 * @param host - puny 正規化済みホスト
 * @returns 解決されたユーザー
 * @internal
 */
async function resolveRemoteUser(
	username: string,
	usernameLower: string,
	host: string,
): Promise<User> {
	const user = (await Users.findOneBy({
		usernameLower,
		host,
	})) as IRemoteUser | null;

	const acctLower = `${usernameLower}@${host}`;

	if (user == null) {
		const self = await resolveSelf(acctLower);

		logger.succ(`return new remote user: ${chalk.magenta(acctLower)}`);
		return await createPerson(self.href);
	}

	// ユーザー情報が古い場合は WebFinger からやり直して返す
	if (
		user.lastFetchedAt == null ||
		Date.now() - user.lastFetchedAt.getTime() > RESYNC_INTERVAL_MS
	) {
		// 接続できないインスタンスへの多重試行を防ぐため、試行前に lastFetchedAt を更新する
		await Users.update(user.id, {
			lastFetchedAt: new Date(),
		});

		logger.info(`try resync: ${acctLower}`);
		const self = await resolveSelf(acctLower);
		const resolver = new Resolver();
		const personObject = await resolver.resolve(self.href);

		if (user.uri !== self.href) {
			// URI 不一致時: user@host と AP の Person id (IRemoteUser.uri) の対応を修正する
			logger.info(`uri missmatch: ${acctLower}`);
			logger.info(
				`recovery missmatch uri for (username=${username}, host=${host}) from ${user.uri} to ${self.href}`,
			);

			// URI の妥当性を検証
			const uri = new URL(self.href);
			if (uri.hostname !== host) {
				throw new Error("Invalid uri");
			}

			await Users.update(
				{
					usernameLower,
					host: host,
				},
				{
					uri: self.href,
				},
			);
		} else {
			logger.debug(`uri は問題なし: ${acctLower}`);
		}

		// hint を渡して Person の二重取得を避ける
		await updatePerson(self.href, resolver, personObject);

		logger.info(`return resynced remote user: ${acctLower}`);
		return await Users.findOneBy({ uri: self.href }).then((u) => {
			if (u == null) {
				throw new Error("user not found");
			} else {
				return u;
			}
		});
	}

	logger.info(`return existing remote user: ${acctLower}`);
	return user;
}

/**
 * WebFinger から self リンクを取得する。
 *
 * @param acctLower - `username@host`（小文字・puny 済み）
 * @returns self リンク
 * @internal
 */
async function resolveSelf(acctLower: string) {
	logger.info(`WebFinger for ${chalk.yellow(acctLower)}`);
	const finger = await webFinger(acctLower).catch((e) => {
		logger.error(
			`Failed to WebFinger for ${chalk.yellow(acctLower)}: ${
				e.statusCode || e.message
			}`,
		);
		throw new Error(
			`Failed to WebFinger for ${acctLower}: ${e.statusCode || e.message}`,
		);
	});
	const self = finger.links.find(
		(link) => link.rel != null && link.rel.toLowerCase() === "self",
	);
	if (!self) {
		logger.error(
			`Failed to WebFinger for ${chalk.yellow(acctLower)}: self link not found`,
		);
		throw new Error("self link not found");
	}
	return self;
}
