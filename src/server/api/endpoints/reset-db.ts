import $ from 'cafy';
import define from '../define.js';
import { ApiError } from '../error.js';
import { resetDb } from '@/db/postgre.js';

export const meta = {
	requireCredential: false as const,

	params: {
	},

	errors: {

	}
};

export default define(meta, async (ps, user) => {
	if (process.env.NODE_ENV !== 'test') throw 'NODE_ENV is not a test';

	await resetDb();
});
