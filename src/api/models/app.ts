import * as mongo from 'mongodb';
import deepcopy = require('deepcopy');
import AccessToken from './access-token';
import db from '../../db/mongodb';
import config from '../../conf';

const App = db.get<IApp>('apps');
App.createIndex('name_id');
App.createIndex('name_id_lower');
App.createIndex('secret');
export default App;

export type IApp = {
	_id: mongo.ObjectID;
	created_at: Date;
	user_id: mongo.ObjectID;
};

export function isValidNameId(nameId: string): boolean {
	return typeof nameId == 'string' && /^[a-zA-Z0-9\-]{3,30}$/.test(nameId);
}

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

	delete _app.name_id_lower;

	// Visible by only owner
	if (!opts.includeSecret) {
		delete _app.secret;
	}

	_app.icon_url = _app.icon != null
		? `${config.drive_url}/${_app.icon}`
		: `${config.drive_url}/app-default.jpg`;

	if (me) {
		// 既に連携しているか
		const exist = await AccessToken.count({
			app_id: _app.id,
			user_id: me,
		}, {
				limit: 1
			});

		_app.is_authorized = exist === 1;
	}

	resolve(_app);
});
