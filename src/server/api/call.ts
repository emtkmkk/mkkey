import endpoints, { Endpoint } from './endpoints';
import limitter from './limitter';
import { IUser } from '../../models/user';
import { IApp } from '../../models/app';

export default (endpoint: string | Endpoint, user: IUser, app: IApp, data: any, file?: any) => new Promise<any>(async (ok, rej) => {
	const isSecure = user != null && app == null;

	const ep = typeof endpoint == 'string' ? endpoints.find(e => e.name == endpoint) : endpoint;

	if (ep.name.includes('.')) {
		return rej('INVALID_ENDPOINT');
	}

	if (ep.secure && !isSecure) {
		return rej('ACCESS_DENIED');
	}

	if (ep.withCredential && user == null) {
		return rej('SIGNIN_REQUIRED');
	}

	if (app && ep.kind) {
		if (!app.permission.some(p => p === ep.kind)) {
			return rej('PERMISSION_DENIED');
		}
	}

	if (ep.withCredential && ep.limit) {
		try {
			await limitter(ep, user); // Rate limit
		} catch (e) {
			// drop request if limit exceeded
			return rej('RATE_LIMIT_EXCEEDED');
		}
	}

	let exec = require(`${__dirname}/endpoints/${ep.name}`).default;

	if (ep.withFile && file) {
		exec = exec.bind(null, file);
	}

	let res;

	// API invoking
	try {
		res = await exec(data, user, app);
	} catch (e) {
		rej(e);
		return;
	}

	ok(res);
});
