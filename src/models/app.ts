import * as mongo from 'mongodb';
const deepcopy = require('deepcopy');
import AccessToken from './access-token';
import db from '../db/mongodb';
import config from '../config';

const App = db.get<IApp>('apps');
App.createIndex('secret');
export default App;

export type IApp = {
	_id: mongo.ObjectID;
	createdAt: Date;
	userId: mongo.ObjectID | null;
	secret: string;
	name: string;
	description: string;
	permission: string[];
	callbackUrl: string;
};

/**
 * Pack an app for API response
 *
 * @param {any} app
 * @param {any} me?
 * @param {any} options?
 * @return {Promise<any>}
 */
export const pack = (
	app: any,
	me?: any,
	options?: {
		includeSecret?: boolean,
		includeProfileImageIds?: boolean
	}
) => new Promise<any>(async (resolve, reject) => {
	const opts = options || {
		includeSecret: false,
		includeProfileImageIds: false
	};

	let _app: any;

	// Populate the app if 'app' is ID
	if (mongo.ObjectID.prototype.isPrototypeOf(app)) {
		_app = await App.findOne({
			_id: app
		});
	} else if (typeof app === 'string') {
		_app = await App.findOne({
			_id: new mongo.ObjectID(app)
		});
	} else {
		_app = deepcopy(app);
	}

	// Me
	if (me && !mongo.ObjectID.prototype.isPrototypeOf(me)) {
		if (typeof me === 'string') {
			me = new mongo.ObjectID(me);
		} else {
			me = me._id;
		}
	}

	// Rename _id to id
	_app.id = _app._id;
	delete _app._id;

	// Visible by only owner
	if (!opts.includeSecret) {
		delete _app.secret;
	}

	_app.iconUrl = _app.icon != null
		? `${config.drive_url}/${_app.icon}`
		: `${config.drive_url}/app-default.jpg`;

	if (me) {
		// 既に連携しているか
		const exist = await AccessToken.count({
			appId: _app.id,
			userId: me,
		}, {
				limit: 1
			});

		_app.isAuthorized = exist === 1;
	}

	resolve(_app);
});
