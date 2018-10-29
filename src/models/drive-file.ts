import * as mongo from 'mongodb';
const deepcopy = require('deepcopy');
import { pack as packFolder } from './drive-folder';
import config from '../config';
import monkDb, { nativeDbConn } from '../db/mongodb';
import isObjectId from '../misc/is-objectid';

const DriveFile = monkDb.get<IDriveFile>('driveFiles.files');
DriveFile.createIndex('md5');
DriveFile.createIndex('metadata.uri');
DriveFile.createIndex('metadata.userId');
DriveFile.createIndex('metadata.folderId');
export default DriveFile;

export const DriveFileChunk = monkDb.get('driveFiles.chunks');

export const getDriveFileBucket = async (): Promise<mongo.GridFSBucket> => {
	const db = await nativeDbConn();
	const bucket = new mongo.GridFSBucket(db, {
		bucketName: 'driveFiles'
	});
	return bucket;
};

export type IMetadata = {
	properties: any;
	userId: mongo.ObjectID;
	_user: any;
	folderId: mongo.ObjectID;
	comment: string;
	uri?: string;
	url?: string;
	thumbnailUrl?: string;
	src?: string;
	deletedAt?: Date;
	withoutChunks?: boolean;
	storage?: string;
	storageProps?: any;
	isSensitive?: boolean;

	/**
	 * このファイルが添付された投稿のID一覧
	 */
	attachedNoteIds?: mongo.ObjectID[];

	/**
	 * 外部の(信頼されていない)URLへの直リンクか否か
	 */
	isRemote?: boolean;
};

export type IDriveFile = {
	_id: mongo.ObjectID;
	uploadDate: Date;
	md5: string;
	filename: string;
	contentType: string;
	metadata: IMetadata;

	/**
	 * ファイルサイズ
	 */
	length: number;
};

export function validateFileName(name: string): boolean {
	return (
		(name.trim().length > 0) &&
		(name.length <= 200) &&
		(name.indexOf('\\') === -1) &&
		(name.indexOf('/') === -1) &&
		(name.indexOf('..') === -1)
	);
}

export const packMany = async (
	files: any[],
	options?: {
		detail: boolean
	}
) => {
	return (await Promise.all(files.map(f => pack(f, options)))).filter(x => x != null);
};

/**
 * Pack a drive file for API response
 */
export const pack = (
	file: any,
	options?: {
		detail: boolean
	}
) => new Promise<any>(async (resolve, reject) => {
	const opts = Object.assign({
		detail: false
	}, options);

	let _file: any;

	// Populate the file if 'file' is ID
	if (isObjectId(file)) {
		_file = await DriveFile.findOne({
			_id: file
		});
	} else if (typeof file === 'string') {
		_file = await DriveFile.findOne({
			_id: new mongo.ObjectID(file)
		});
	} else {
		_file = deepcopy(file);
	}

	// (データベースの欠損などで)ファイルがデータベース上に見つからなかったとき
	if (_file == null) {
		console.warn(`[DAMAGED DB] (missing) pkg: driveFile :: ${file}`);
		return resolve(null);
	}

	// rendered target
	let _target: any = {};

	_target.id = _file._id;
	_target.createdAt = _file.uploadDate;
	_target.name = _file.filename;
	_target.type = _file.contentType;
	_target.datasize = _file.length;
	_target.md5 = _file.md5;

	_target = Object.assign(_target, _file.metadata);

	_target.url = _file.metadata.url ? _file.metadata.url : `${config.drive_url}/${_target.id}/${encodeURIComponent(_target.name)}`;
	_target.thumbnailUrl = _file.metadata.thumbnailUrl ? _file.metadata.thumbnailUrl : _file.metadata.url ? _file.metadata.url : `${config.drive_url}/${_target.id}/${encodeURIComponent(_target.name)}?thumbnail`;
	_target.isRemote = _file.metadata.isRemote;

	if (_target.properties == null) _target.properties = {};

	if (opts.detail) {
		if (_target.folderId) {
			// Populate folder
			_target.folder = await packFolder(_target.folderId, {
				detail: true
			});
		}

		/*
		if (_target.tags) {
			// Populate tags
			_target.tags = await _target.tags.map(async (tag: any) =>
				await serializeDriveTag(tag)
			);
		}
		*/
	}

	delete _target.withoutChunks;
	delete _target.storage;
	delete _target.storageProps;
	delete _target.isRemote;

	resolve(_target);
});
