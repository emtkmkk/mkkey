/**
 * Module dependencies
 */
import $ from 'cafy';
import DriveFolder from '../../../models/drive-folder';
import DriveFile from '../../../models/drive-file';
import { validateFileName } from '../../../models/drive-file';
import serialize from '../../../serializers/drive-file';
import { publishDriveStream } from '../../../event';

/**
 * Update a file
 *
 * @param {any} params
 * @param {any} user
 * @return {Promise<any>}
 */
module.exports = (params, user) => new Promise(async (res, rej) => {
	// Get 'file_id' parameter
	const [fileId, fileIdErr] = $(params.file_id).id().$;
	if (fileIdErr) return rej('invalid file_id param');

	// Fetch file
	const file = await DriveFile
		.findOne({
			_id: fileId,
			'metadata.user_id': user._id
		});

	if (file === null) {
		return rej('file-not-found');
	}

	// Get 'name' parameter
	const [name, nameErr] = $(params.name).optional.string().pipe(validateFileName).$;
	if (nameErr) return rej('invalid name param');
	if (name) file.filename = name;

	// Get 'folder_id' parameter
	const [folderId, folderIdErr] = $(params.folder_id).optional.nullable.id().$;
	if (folderIdErr) return rej('invalid folder_id param');

	if (folderId !== undefined) {
		if (folderId === null) {
			file.metadata.folder_id = null;
		} else {
			// Fetch folder
			const folder = await DriveFolder
				.findOne({
					_id: folderId,
					user_id: user._id
				});

			if (folder === null) {
				return rej('folder-not-found');
			}

			file.metadata.folder_id = folder._id;
		}
	}

	await DriveFile.update(file._id, {
		$set: {
			filename: file.filename,
			'metadata.folder_id': file.metadata.folder_id
		}
	});

	// Serialize
	const fileObj = await serialize(file);

	// Response
	res(fileObj);

	// Publish file_updated event
	publishDriveStream(user._id, 'file_updated', fileObj);
});
