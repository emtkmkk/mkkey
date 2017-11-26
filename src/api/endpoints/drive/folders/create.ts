/**
 * Module dependencies
 */
import $ from 'cafy';
import DriveFolder from '../../../models/drive-folder';
import { isValidFolderName } from '../../../models/drive-folder';
import serialize from '../../../serializers/drive-folder';
import { publishDriveStream } from '../../../event';

/**
 * Create drive folder
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	// Get 'name' parameter
	const [name = '無題のフォルダー', nameErr] = $(params.name).optional.string().pipe(isValidFolderName).$;
	if (nameErr) return rej('invalid name param');

	// Get 'parent_id' parameter
	const [parentId = null, parentIdErr] = $(params.parent_id).optional.nullable.id().$;
	if (parentIdErr) return rej('invalid parent_id param');

	// If the parent folder is specified
	let parent = null;
	if (parentId) {
		// Fetch parent folder
		parent = await DriveFolder
			.findOne({
				_id: parentId,
				user_id: user._id
			});

		if (parent === null) {
			return rej('parent-not-found');
		}
	}

	// Create folder
	const folder = await DriveFolder.insert({
		created_at: new Date(),
		name: name,
		parent_id: parent !== null ? parent._id : null,
		user_id: user._id
	});

	// Serialize
	const folderObj = await serialize(folder);

	// Response
	res(folderObj);

	// Publish folder_created event
	publishDriveStream(user._id, 'folder_created', folderObj);
});
