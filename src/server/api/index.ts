/**
 * API Server
 */

import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as multer from 'koa-multer';
import * as bodyParser from 'koa-bodyparser';
const cors = require('@koa/cors');

import endpoints from './endpoints';

const handler = require('./api-handler').default;

// Init app
const app = new Koa();

app.use(cors({
	origin: '*'
}));

app.use(bodyParser({
	// リクエストが multipart/form-data でない限りはJSONだと見なす
	detectJSON: ctx => !ctx.is('multipart/form-data')
}));

// Init multer instance
const upload = multer({
	storage: multer.diskStorage({})
});

// Init router
const router = new Router();

/**
 * Register endpoint handlers
 */
endpoints.forEach(endpoint => endpoint.meta.requireFile
	? router.post(`/${endpoint.name}`, upload.single('file'), handler.bind(null, endpoint))
	: router.post(`/${endpoint.name}`, handler.bind(null, endpoint))
);

router.post('/signup', require('./private/signup').default);
router.post('/signin', require('./private/signin').default);

router.use(require('./service/github').routes());
router.use(require('./service/twitter').routes());

// Return 404 for unknown API
router.all('*', async ctx => {
	ctx.status = 404;
});

// Register router
app.use(router.routes());

module.exports = app;
