/**
 * Module dependencies
 */
import $ from 'cafy';
import App from '../../../../../models/app';
import AuthSess from '../../../../../models/auth-session';
import AccessToken from '../../../../../models/access-token';
import { pack } from '../../../../../models/user';

/**
 * Generate a session
 *
 * @param {any} params
 * @return {Promise<any>}
 */
export default (params: any) => new Promise(async (res, rej) => {
	// Get 'appSecret' parameter
	const [appSecret, appSecretErr] = $.str.get(params.appSecret);
	if (appSecretErr) return rej('invalid appSecret param');

	// Lookup app
	const app = await App.findOne({
		secret: appSecret
	});

	if (app == null) {
		return rej('app not found');
	}

	// Get 'token' parameter
	const [token, tokenErr] = $.str.get(params.token);
	if (tokenErr) return rej('invalid token param');

	// Fetch token
	const session = await AuthSess
		.findOne({
			token: token,
			appId: app._id
		});

	if (session === null) {
		return rej('session not found');
	}

	if (session.userId == null) {
		return rej('this session is not allowed yet');
	}

	// Lookup access token
	const accessToken = await AccessToken.findOne({
		appId: app._id,
		userId: session.userId
	});

	// Delete session

	/* https://github.com/Automattic/monk/issues/178
	AuthSess.deleteOne({
		_id: session._id
	});
	*/
	AuthSess.remove({
		_id: session._id
	});

	// Response
	res({
		accessToken: accessToken.token,
		user: await pack(session.userId, null, {
			detail: true
		})
	});
});
