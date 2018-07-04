import * as Koa from 'koa';
import * as bcrypt from 'bcryptjs';
import { generate as generateKeypair } from '../../../crypto_key';
const recaptcha = require('recaptcha-promise');
import User, { IUser, validateUsername, validatePassword, pack } from '../../../models/user';
import generateUserToken from '../common/generate-native-user-token';
import config from '../../../config';
import Meta from '../../../models/meta';

recaptcha.init({
	secret_key: config.recaptcha.secret_key
});

export default async (ctx: Koa.Context) => {
	// Verify recaptcha
	// ただしテスト時はこの機構は障害となるため無効にする
	if (process.env.NODE_ENV !== 'test') {
		const success = await recaptcha(ctx.request.body['g-recaptcha-response']);

		if (!success) {
			ctx.throw(400, 'recaptcha-failed');
			return;
		}
	}

	const username = ctx.request.body['username'];
	const password = ctx.request.body['password'];

	// Validate username
	if (!validateUsername(username)) {
		ctx.status = 400;
		return;
	}

	// Validate password
	if (!validatePassword(password)) {
		ctx.status = 400;
		return;
	}

	// Fetch exist user that same username
	const usernameExist = await User
		.count({
			usernameLower: username.toLowerCase(),
			host: null
		}, {
			limit: 1
		});

	// Check username already used
	if (usernameExist !== 0) {
		ctx.status = 400;
		return;
	}

	// Generate hash of password
	const salt = await bcrypt.genSalt(8);
	const hash = await bcrypt.hash(password, salt);

	// Generate secret
	const secret = generateUserToken();

	// Create account
	const account: IUser = await User.insert({
		avatarId: null,
		bannerId: null,
		createdAt: new Date(),
		description: null,
		followersCount: 0,
		followingCount: 0,
		name: null,
		notesCount: 0,
		driveCapacity: 1024 * 1024 * 128, // 128MiB
		username: username,
		usernameLower: username.toLowerCase(),
		host: null,
		keypair: generateKeypair(),
		token: secret,
		email: null,
		password: hash,
		profile: {
			bio: null,
			birthday: null,
			blood: null,
			gender: null,
			handedness: null,
			height: null,
			location: null,
			weight: null
		},
		settings: {
			autoWatch: true
		}
	});

	//#region Increment users count
	Meta.update({}, {
		$inc: {
			'stats.usersCount': 1,
			'stats.originalUsersCount': 1
		}
	}, { upsert: true });
	//#endregion

	// Response
	ctx.body = await pack(account);
};
