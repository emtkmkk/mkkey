import $ from 'cafy';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { Pages, Users } from '@/models/index.js';
import { ID } from '@/misc/cafy-id.js';
import { Page } from '@/models/entities/page.js';

export const meta = {
	tags: ['pages'],

	requireCredential: false as const,

	params: {
		pageId: {
			validator: $.optional.type(ID),
		},

		name: {
			validator: $.optional.str,
		},

		username: {
			validator: $.optional.str,
		},
	},

	res: {
		type: 'object' as const,
		optional: false as const, nullable: false as const,
		ref: 'Page',
	},

	errors: {
		noSuchPage: {
			message: 'No such page.',
			code: 'NO_SUCH_PAGE',
			id: '222120c0-3ead-4528-811b-b96f233388d7'
		}
	}
};

export default define(meta, async (ps, user) => {
	let page: Page | undefined;

	if (ps.pageId) {
		page = await Pages.findOne(ps.pageId);
	} else if (ps.name && ps.username) {
		const author = await Users.findOne({
			host: null,
			usernameLower: ps.username.toLowerCase()
		});
		if (author) {
			page = await Pages.findOne({
				name: ps.name,
				userId: author.id
			});
		}
	}

	if (page == null) {
		throw new ApiError(meta.errors.noSuchPage);
	}

	return await Pages.pack(page, user);
});
