import { generateKeyPair } from "node:crypto";
import generateUserToken from "./generate-native-user-token.js";
import { User } from "@/models/entities/user.js";
import { Users, UsedUsernames } from "@/models/index.js";
import { UserProfile } from "@/models/entities/user-profile.js";
import { IsNull } from "typeorm";
import { genId } from "@/misc/gen-id.js";
import { toPunyNullable } from "@/misc/convert-host.js";
import { UserKeypair } from "@/models/entities/user-keypair.js";
import { usersChart } from "@/services/chart/index.js";
import { UsedUsername } from "@/models/entities/used-username.js";
import { db } from "@/db/postgre.js";
import config from "@/config/index.js";
import { hashPassword } from "@/misc/password.js";

export async function signup(opts: {
	username: User["username"];
	password?: string | null;
	passwordHash?: UserProfile["password"] | null;
	host?: string | null;
	inviteUserId?: string | null;
}) {
	const { username, password, passwordHash, host, inviteUserId } = opts;
	let hash = passwordHash;

	const userCount = await Users.countBy({
		host: IsNull(),
		isDeleted: false,
	});

	if (config.maxUserSignups != null && userCount > config.maxUserSignups) {
		throw new Error("MAX_USERS_REACHED");
	}

	// Validate username
	if (!Users.validateLocalUsername(username)) {
		throw new Error("INVALID_USERNAME");
	}

	if (password != null && passwordHash == null) {
		// Validate password
		if (!Users.validatePassword(password)) {
			throw new Error("INVALID_PASSWORD");
		}

		// Generate hash of password
		hash = await hashPassword(password);
	}

	// Generate secret
	const secret = generateUserToken();

	// 予約ワードのチェック
	const preservedUsernames = [
		"admin",
		"administrator",
		"root",
		"system",
		"maintainer",
		"host",
		"mod",
		"moderator",
		"owner",
		"superuser",
		"staff",
		"auth",
		"i",
		"me",
		"everyone",
		"all",
		"mention",
		"mentions",
		"example",
		"user",
		"users",
		"account",
		"accounts",
		"official",
		"help",
		"helps",
		"support",
		"supports",
		"info",
		"information",
		"informations",
		"announce",
		"announces",
		"announcement",
		"announcements",
		"notice",
		"notification",
		"notifications",
		"dev",
		"developer",
		"developers",
		"tech",
		"misskey",
		"tos",
		"calckey",
		"mkkey",
	];

	if (preservedUsernames.includes(username.toLowerCase())) {
		throw new Error("USED_USERNAME");
	}

	// ID 1文字はやめてほしい
	if (username.length <= 1) {
		throw new Error("USED_USERNAME");
	}

	// Check username duplication
	if (
		await Users.findOneBy({
			usernameLower: username.toLowerCase(),
			host: IsNull(),
		})
	) {
		throw new Error("DUPLICATED_USERNAME");
	}

	// Check deleted username duplication
	if (await UsedUsernames.findOneBy({ username: username.toLowerCase() })) {
		throw new Error("USED_USERNAME");
	}

	const keyPair = await new Promise<string[]>((res, rej) =>
		generateKeyPair(
			"rsa",
			{
				modulusLength: 4096,
				publicKeyEncoding: {
					type: "spki",
					format: "pem",
				},
				privateKeyEncoding: {
					type: "pkcs8",
					format: "pem",
					cipher: undefined,
					passphrase: undefined,
				},
			} as any,
			(err, publicKey, privateKey) =>
				err ? rej(err) : res([publicKey, privateKey]),
		),
	);

	let account!: User;

	// Start transaction
	await db.transaction(async (transactionalEntityManager) => {
		const exist = await transactionalEntityManager.findOneBy(User, {
			usernameLower: username.toLowerCase(),
			host: IsNull(),
		});

		if (exist) throw new Error(" the username is already used");

		account = await transactionalEntityManager.save(
			new User({
				id: genId(),
				createdAt: new Date(),
				username: username,
				usernameLower: username.toLowerCase(),
				host: toPunyNullable(host),
				token: secret,
				inviteUserId,
				isAdmin:
					(await Users.countBy({
						host: IsNull(),
						isAdmin: true,
					})) === 0,
			}),
		);

		await transactionalEntityManager.save(
			new UserKeypair({
				publicKey: keyPair[0],
				privateKey: keyPair[1],
				userId: account.id,
			}),
		);

		await transactionalEntityManager.save(
			new UserProfile({
				userId: account.id,
				autoAcceptFollowed: true,
				password: hash,
			}),
		);

		await transactionalEntityManager.save(
			new UsedUsername({
				createdAt: new Date(),
				username: username.toLowerCase(),
			}),
		);
	});

	usersChart.update(account, true);

	return { account, secret };
}
