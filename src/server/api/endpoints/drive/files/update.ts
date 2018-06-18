import $ from 'cafy'; import ID from '../../../../../cafy-id';
import DriveFolder from '../../../../../models/drive-folder';
import DriveFile, { validateFileName, pack } from '../../../../../models/drive-file';
import { publishDriveStream } from '../../../../../publishers/stream';
import { ILocalUser } from '../../../../../models/user';

/**
 * Update a file
 */
module.exports = (params: any, user: ILocalUser) => new Promise(async (res, rej) => {
	// Get 'fileId' parameter
	const [fileId, fileIdErr] = $.type(ID).get(params.fileId);
	if (fileIdErr) return rej('invalid fileId param');

	// Fetch file
	const file = await DriveFile
		.findOne({
			_id: fileId,
			'metadata.userId': user._id
		});

	if (file === null) {
		return rej('file-not-found');
	}

	// Get 'name' parameter
	const [name, nameErr] = $.str.optional().pipe(validateFileName).get(params.name);
	if (nameErr) return rej('invalid name param');
	if (name) file.filename = name;

	// Get 'folderId' parameter
	const [folderId, folderIdErr] = $.type(ID).optional().nullable().get(params.folderId);
	if (folderIdErr) return rej('invalid folderId param');

	if (folderId !== undefined) {
		if (folderId === null) {
			file.metadata.folderId = null;
		} else {
			// Fetch folder
			const folder = await DriveFolder
				.findOne({
					_id: folderId,
					userId: user._id
				});

			if (folder === null) {
				return rej('folder-not-found');
			}

			file.metadata.folderId = folder._id;
		}
	}

	await DriveFile.update(file._id, {
		$set: {
			filename: file.filename,
			'metadata.folderId': file.metadata.folderId
		}
	});

	// Serialize
	const fileObj = await pack(file);

	// Response
	res(fileObj);

	// Publish file_updated event
	publishDriveStream(user._id, 'file_updated', fileObj);
});
