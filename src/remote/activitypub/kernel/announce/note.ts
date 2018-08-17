import * as debug from 'debug';

import Resolver from '../../resolver';
import post from '../../../../services/note/create';
import { IRemoteUser, IUser } from '../../../../models/user';
import { IAnnounce, INote } from '../../type';
import { fetchNote, resolveNote } from '../../models/note';
import { resolvePerson } from '../../models/person';

const log = debug('misskey:activitypub');

/**
 * アナウンスアクティビティを捌きます
 */
export default async function(resolver: Resolver, actor: IRemoteUser, activity: IAnnounce, note: INote): Promise<void> {
	const uri = activity.id || activity;

	// アナウンサーが凍結されていたらスキップ
	if (actor.isSuspended) {
		return;
	}

	if (typeof uri !== 'string') {
		throw new Error('invalid announce');
	}

	// 既に同じURIを持つものが登録されていないかチェック
	const exist = await fetchNote(uri);
	if (exist) {
		return;
	}

	const renote = await resolveNote(note);

	log(`Creating the (Re)Note: ${uri}`);

	//#region Visibility
	let visibility = 'public';
	let visibleUsers: IUser[] = [];
	if (!note.to.includes('https://www.w3.org/ns/activitystreams#Public')) {
		if (note.cc.includes('https://www.w3.org/ns/activitystreams#Public')) {
			visibility = 'home';
		} else if (note.to.includes(`${actor.uri}/followers`)) {	// TODO: person.followerと照合するべき？
			visibility = 'followers';
		} else {
			visibility = 'specified';
			visibleUsers = await Promise.all(note.to.map(uri => resolvePerson(uri)));
		}
	}
	//#endergion

	await post(actor, {
		createdAt: new Date(activity.published),
		renote,
		visibility,
		visibleUsers,
		uri
	});
}
