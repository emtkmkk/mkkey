import * as debug from 'debug';

import Resolver from '../../resolver';
import { IRemoteUser } from '../../../../models/user';
import announceNote from './note';
import { IAnnounce, INote } from '../../type';

const log = debug('misskey:activitypub');

export default async (actor: IRemoteUser, activity: IAnnounce): Promise<void> => {
	const uri = activity.id || activity;

	log(`Announce: ${uri}`);

	const resolver = new Resolver();

	let object;

	try {
		object = await resolver.resolve(activity.object);
	} catch (e) {
		log(`Resolution failed: ${e}`);
		throw e;
	}

	switch (object.type) {
	case 'Note':
		announceNote(resolver, actor, activity, object as INote);
		break;

	default:
		console.warn(`Unknown announce type: ${object.type}`);
		break;
	}
};
