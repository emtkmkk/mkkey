import { performance } from 'perf_hooks';
import limiter from './limiter';
import { IUser } from '../../models/user';
import { IApp } from '../../models/app';
import endpoints from './endpoints';

export default (endpoint: string, user: IUser, app: IApp, data: any, file?: any) => new Promise<any>(async (ok, rej) => {
	const isSecure = user != null && app == null;

	const ep = endpoints.find(e => e.name === endpoint);

	if (ep == null) {
		return rej('ENDPOINT_NOT_FOUND');
	}

	if (ep.meta.secure && !isSecure) {
		return rej('ACCESS_DENIED');
	}

	if (ep.meta.requireCredential && user == null) {
		return rej('CREDENTIAL_REQUIRED');
	}

	if (ep.meta.requireCredential && user.isSuspended) {
		return rej('YOUR_ACCOUNT_HAS_BEEN_SUSPENDED');
	}

	if (ep.meta.requireAdmin && !user.isAdmin) {
		return rej('YOU_ARE_NOT_ADMIN');
	}

	if (ep.meta.requireModerator && !user.isAdmin && !user.isModerator) {
		return rej('YOU_ARE_NOT_MODERATOR');
	}

	if (app && ep.meta.kind && !app.permission.some(p => p === ep.meta.kind)) {
		return rej('PERMISSION_DENIED');
	}

	if (ep.meta.requireCredential && ep.meta.limit) {
		try {
			await limiter(ep, user); // Rate limit
		} catch (e) {
			// drop request if limit exceeded
			return rej('RATE_LIMIT_EXCEEDED');
		}
	}

	let res;

	// API invoking
	try {
		const before = performance.now();
		res = await ep.exec(data, user, app, file);
		const after = performance.now();

		const time = after - before;

		if (time > 1000) {
			console.warn(`SLOW API CALL DETECTED: ${ep.name} (${time}ms)`);
		}
	} catch (e) {
		if (e && e.name == 'INVALID_PARAM') {
			rej({
				code: e.name,
				param: e.param,
				reason: e.message
			});
		} else {
			rej(e);
		}
		return;
	}

	ok(res);
});
