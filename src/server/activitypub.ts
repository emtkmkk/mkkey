import * as mongo from 'mongodb';
import * as Router from 'koa-router';
const json = require('koa-json-body');
const httpSignature = require('http-signature');

import { createHttp } from '../queue';
import pack from '../remote/activitypub/renderer';
import Note from '../models/note';
import User, { isLocalUser, ILocalUser, IUser } from '../models/user';
import renderNote from '../remote/activitypub/renderer/note';
import renderKey from '../remote/activitypub/renderer/key';
import renderPerson from '../remote/activitypub/renderer/person';
import renderOrderedCollection from '../remote/activitypub/renderer/ordered-collection';
//import parseAcct from '../acct/parse';
import config from '../config';

// Init router
const router = new Router();

//#region Routing

function inbox(ctx: Router.IRouterContext) {
	let signature;

	ctx.req.headers.authorization = 'Signature ' + ctx.req.headers.signature;

	try {
		signature = httpSignature.parseRequest(ctx.req);
	} catch (e) {
		ctx.status = 401;
		return;
	}

	createHttp({
		type: 'processInbox',
		activity: ctx.request.body,
		signature
	}).save();

	ctx.status = 202;
}

function isActivityPubReq(ctx: Router.IRouterContext) {
	const accepted = ctx.accepts('html', 'application/activity+json', 'application/ld+json');
	return ['application/activity+json', 'application/ld+json'].includes(accepted as string);
}

// inbox
router.post('/inbox', json(), inbox);
router.post('/users/:user/inbox', json(), inbox);

// note
router.get('/notes/:note', async (ctx, next) => {
	if (!isActivityPubReq(ctx)) return await next();

	const note = await Note.findOne({
		_id: new mongo.ObjectID(ctx.params.note)
	});

	if (note === null) {
		ctx.status = 404;
		return;
	}

	ctx.body = pack(await renderNote(note));
});

// outbot
router.get('/users/:user/outbox', async ctx => {
	const userId = new mongo.ObjectID(ctx.params.user);

	const user = await User.findOne({
		_id: userId,
		host: null
	});

	if (user === null) {
		ctx.status = 404;
		return;
	}

	const notes = await Note.find({ userId: user._id }, {
		limit: 10,
		sort: { _id: -1 }
	});

	const renderedNotes = await Promise.all(notes.map(note => renderNote(note)));
	const rendered = renderOrderedCollection(`${config.url}/users/${userId}/inbox`, user.notesCount, renderedNotes);

	ctx.body = pack(rendered);
});

// publickey
router.get('/users/:user/publickey', async ctx => {
	const userId = new mongo.ObjectID(ctx.params.user);

	const user = await User.findOne({
		_id: userId,
		host: null
	});

	if (user === null) {
		ctx.status = 404;
		return;
	}

	if (isLocalUser(user)) {
		ctx.body = pack(renderKey(user));
	} else {
		ctx.status = 400;
	}
});

// user
function userInfo(ctx: Router.IRouterContext, user: IUser) {
	if (user === null) {
		ctx.status = 404;
		return;
	}

	ctx.body = pack(renderPerson(user as ILocalUser));
}

router.get('/users/:user', async ctx => {
	const userId = new mongo.ObjectID(ctx.params.user);

	const user = await User.findOne({
		_id: userId,
		host: null
	});

	userInfo(ctx, user);
});

router.get('/@:user', async (ctx, next) => {
	if (!isActivityPubReq(ctx)) return await next();

	const user = await User.findOne({
		usernameLower: ctx.params.user.toLowerCase(),
		host: null
	});

	userInfo(ctx, user);
});

// follow form
router.get('/authorize-follow', async ctx => {
	/* TODO
	const { username, host } = parseAcct(ctx.query.acct);
	if (host === null) {
		res.sendStatus(422);
		return;
	}

	const finger = await request(`https://${host}`)
	*/
});

//#endregion

export default router;
