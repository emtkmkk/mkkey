import rndstr from 'rndstr';
import $ from 'cafy';
import App, { pack } from '../../../../models/app';
import { ILocalUser } from '../../../../models/user';

export const meta = {
	requireCredential: false
};

/**
 * Create an app
 */
export default async (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'name' parameter
	const [name, nameErr] = $.str.get(params.name);
	if (nameErr) return rej('invalid name param');

	// Get 'description' parameter
	const [description, descriptionErr] = $.str.get(params.description);
	if (descriptionErr) return rej('invalid description param');

	// Get 'permission' parameter
	const [permission, permissionErr] = $.arr($.str).unique().get(params.permission);
	if (permissionErr) return rej('invalid permission param');

	// Get 'callbackUrl' parameter
	// TODO: Check it is valid url
	const [callbackUrl = null, callbackUrlErr] = $.str.optional.nullable.get(params.callbackUrl);
	if (callbackUrlErr) return rej('invalid callbackUrl param');

	// Generate secret
	const secret = rndstr('a-zA-Z0-9', 32);

	// Create account
	const app = await App.insert({
		createdAt: new Date(),
		userId: user && user._id,
		name: name,
		description: description,
		permission: permission,
		callbackUrl: callbackUrl,
		secret: secret
	});

	// Response
	res(await pack(app, null, {
		includeSecret: true
	}));
});
