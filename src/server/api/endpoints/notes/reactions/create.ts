import $ from 'cafy'; import ID from '../../../../../cafy-id';
import Note from '../../../../../models/note';
import create from '../../../../../services/note/reaction/create';
import { validateReaction } from '../../../../../models/note-reaction';
import { ILocalUser } from '../../../../../models/user';

/**
 * React to a note
 */
module.exports = (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'noteId' parameter
	const [noteId, noteIdErr] = $.type(ID).get(params.noteId);
	if (noteIdErr) return rej('invalid noteId param');

	// Get 'reaction' parameter
	const [reaction, reactionErr] = $.str.pipe(validateReaction.ok).get(params.reaction);
	if (reactionErr) return rej('invalid reaction param');

	// Fetch reactee
	const note = await Note.findOne({
		_id: noteId
	});

	if (note === null) {
		return rej('note not found');
	}

	try {
		await create(user, note, reaction);
	} catch (e) {
		rej(e);
	}

	res();
});
