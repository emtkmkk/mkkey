/**
 * @packageDocumentation
 *
 * システム用ユーザー（インスタンスアクター等）を作成するサービス。
 *
 * @remarks
 * - **役割**: リレー等で利用するシステムアカウント（relay.actor 等）を DB に作成する。Users/UserKeypair/UserProfile を登録する。
 *
 * @see {@link relay} リレー
 * @internal
 */
import { v4 as uuid } from "uuid";
import generateNativeUserToken from "../server/api/common/generate-native-user-token.js";
import { genRsaKeyPair } from "@/misc/gen-key-pair.js";
import { User } from "@/models/entities/user.js";
import { UserProfile } from "@/models/entities/user-profile.js";
import { IsNull } from "typeorm";
import { genId } from "@/misc/gen-id.js";
import { UserKeypair } from "@/models/entities/user-keypair.js";
import { UsedUsername } from "@/models/entities/used-username.js";
import { db } from "@/db/postgre.js";
import { hashPassword } from "@/misc/password.js";

export async function createSystemUser(username: string) {
	const password = uuid();

	// パスワードのハッシュを生成
	const hash = await hashPassword(password);

	// シークレットを生成
	const secret = generateNativeUserToken();

	const keyPair = await genRsaKeyPair(4096);

	let account!: User;

	// トランザクション開始
	await db.transaction(async (transactionalEntityManager) => {
		const exist = await transactionalEntityManager.findOneBy(User, {
			usernameLower: username.toLowerCase(),
			host: IsNull(),
		});

		if (exist) throw new Error("the user is already exists");

		account = await transactionalEntityManager
			.insert(User, {
				id: genId(),
				createdAt: new Date(),
				username: username,
				usernameLower: username.toLowerCase(),
				host: null,
				token: secret,
				isAdmin: false,
				isLocked: true,
				isExplorable: false,
				isBot: true,
			})
			.then((x) =>
				transactionalEntityManager.findOneByOrFail(User, x.identifiers[0]),
			);

		await transactionalEntityManager.insert(UserKeypair, {
			publicKey: keyPair.publicKey,
			privateKey: keyPair.privateKey,
			userId: account.id,
		});

		await transactionalEntityManager.insert(UserProfile, {
			userId: account.id,
			autoAcceptFollowed: false,
			password: hash,
		});

		await transactionalEntityManager.insert(UsedUsername, {
			createdAt: new Date(),
			username: username.toLowerCase(),
		});
	});

	return account;
}
