import $ from 'cafy'; import ID, { transform } from '../../../../../misc/cafy-id';
import DriveFolder from '../../../../../models/drive-folder';
import DriveFile, { validateFileName, pack } from '../../../../../models/drive-file';
import { publishDriveStream } from '../../../../../stream';
import define from '../../../define';
import Note from '../../../../../models/note';

export const meta = {
	desc: {
		'ja-JP': '指定したドライブのファイルの情報を更新します。',
		'en-US': 'Update specified file of drive.'
	},

	requireCredential: true,

	kind: 'drive-write',

	params: {
		fileId: {
			validator: $.type(ID),
			transform: transform,
			desc: {
				'ja-JP': '対象のファイルID'
			}
		},

		folderId: {
			validator: $.type(ID).optional.nullable,
			transform: transform,
			default: undefined as any,
			desc: {
				'ja-JP': 'フォルダID'
			}
		},

		name: {
			validator: $.str.optional.pipe(validateFileName),
			default: undefined as any,
			desc: {
				'ja-JP': 'ファイル名',
				'en-US': 'Name of the file'
			}
		},

		isSensitive: {
			validator: $.bool.optional,
			default: undefined as any,
			desc: {
				'ja-JP': 'このメディアが「閲覧注意」(NSFW)かどうか',
				'en-US': 'Whether this media is NSFW'
			}
		}
	}
};

export default define(meta, (ps, user) => new Promise(async (res, rej) => {
	// Fetch file
	const file = await DriveFile
		.findOne({
			_id: ps.fileId,
			'metadata.userId': user._id
		});

	if (file === null) {
		return rej('file-not-found');
	}

	if (ps.name) file.filename = ps.name;

	if (ps.isSensitive !== undefined) file.metadata.isSensitive = ps.isSensitive;

	if (ps.folderId !== undefined) {
		if (ps.folderId === null) {
			file.metadata.folderId = null;
		} else {
			// Fetch folder
			const folder = await DriveFolder
				.findOne({
					_id: ps.folderId,
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
			'metadata.folderId': file.metadata.folderId,
			'metadata.isSensitive': file.metadata.isSensitive
		}
	});

	// ドライブのファイルが非正規化されているドキュメントも更新
	Note.find({
		'_files._id': file._id
	}).then(notes => {
		notes.forEach(note => {
			note._files[note._files.findIndex(f => f._id.equals(file._id))] = file;
			Note.update({ _id: note._id }, {
				$set: {
					_files: note._files
				}
			});
		});
	});

	// Serialize
	const fileObj = await pack(file, { self: true });

	// Response
	res(fileObj);

	// Publish fileUpdated event
	publishDriveStream(user._id, 'fileUpdated', fileObj);
}));
