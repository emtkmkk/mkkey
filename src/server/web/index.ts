/**
 * Web Client Server
 */

import ms = require('ms');
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as send from 'koa-send';
import * as favicon from 'koa-favicon';
import * as views from 'koa-views';

import docs from './docs';
import User from '../../models/user';
import parseAcct from '../../misc/acct/parse';
import { fa } from '../../misc/fa';
import config from '../../config';
import Note, { pack as packNote } from '../../models/note';
import getNoteSummary from '../../misc/get-note-summary';
const consts = require('../../const.json');

const client = `${__dirname}/../../client/`;

// Init app
const app = new Koa();

// Init renderer
app.use(views(__dirname + '/views', {
	extension: 'pug',
	options: {
		config,
		themeColor: consts.themeColor,
		facss: fa.dom.css()
	}
}));

// Serve favicon
app.use(favicon(`${client}/assets/favicon.ico`));

// Common request handler
app.use(async (ctx, next) => {
	// IFrameの中に入れられないようにする
	ctx.set('X-Frame-Options', 'DENY');
	await next();
});

// Init router
const router = new Router();

//#region static assets

router.get('/assets/*', async ctx => {
	await send(ctx, ctx.path, {
		root: client,
		maxage: ms('7 days'),
		immutable: true
	});
});

// Apple touch icon
router.get('/apple-touch-icon.png', async ctx => {
	await send(ctx, '/assets/apple-touch-icon.png', {
		root: client
	});
});

// ServiceWorker
router.get(/^\/sw\.(.+?)\.js$/, async ctx => {
	await send(ctx, `/assets/sw.${ctx.params[0]}.js`, {
		root: client
	});
});

// Manifest
router.get('/manifest.json', async ctx => {
	await send(ctx, '/assets/manifest.json', {
		root: client
	});
});

//#endregion

// Docs
router.use('/docs', docs.routes());

// URL preview endpoint
router.get('/url', require('./url-preview'));

//#region for crawlers
// User
router.get('/@:user', async (ctx, next) => {
	const { username, host } = parseAcct(ctx.params.user);
	const user = await User.findOne({
		usernameLower: username.toLowerCase(),
		host
	});

	if (user != null) {
		await ctx.render('user', { user });
	} else {
		// リモートユーザーなので
		await next();
	}
});

// Note
router.get('/notes/:note', async ctx => {
	const note = await Note.findOne({ _id: ctx.params.note });

	if (note != null) {
		const _note = await packNote(note);
		await ctx.render('note', {
			note: _note,
			summary: getNoteSummary(_note)
		});
	} else {
		ctx.status = 404;
	}
});
//#endregion

// Render base html for all requests
router.get('*', async ctx => {
	await send(ctx, `app/base.html`, {
		root: client,
		maxage: ms('5m')
	});
});

// Register router
app.use(router.routes());

module.exports = app;
