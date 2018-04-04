import unfollow from './unfollow';

export default async (actor, activity): Promise<void> => {
	if ('actor' in activity && actor.account.uri !== activity.actor) {
		throw new Error('invalid actor');
	}

	switch (activity.object.type) {
		case 'Follow':
			unfollow(activity.object);
			break;
	}

	return null;
};
