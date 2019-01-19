import * as debug from 'debug';

import { IRemoteUser } from '../../../../models/user';
import { IUndo, IFollow, IBlock, ILike } from '../../type';
import unfollow from './follow';
import unblock from './block';
import undoLike from './like';
import Resolver from '../../resolver';

const log = debug('misskey:activitypub');

export default async (actor: IRemoteUser, activity: IUndo): Promise<void> => {
	if ('actor' in activity && actor.uri !== activity.actor) {
		throw new Error('invalid actor');
	}

	const uri = activity.id || activity;

	log(`Undo: ${uri}`);

	const resolver = new Resolver();

	let object;

	try {
		object = await resolver.resolve(activity.object);
	} catch (e) {
		log(`Resolution failed: ${e}`);
		throw e;
	}

	switch (object.type) {
		case 'Follow':
			unfollow(actor, object as IFollow);
			break;
		case 'Block':
			unblock(actor, object as IBlock);
			break;
		case 'Like':
			undoLike(actor, object as ILike);
			break;
	}

	return null;
};
