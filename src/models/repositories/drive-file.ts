import { EntityRepository, Repository } from 'typeorm';
import { DriveFile } from '../entities/drive-file';
import { Users, DriveFolders } from '..';
import { User } from '../entities/user';
import { toPuny } from '../../misc/convert-host';
import { ensure } from '../../prelude/ensure';
import { awaitAll } from '../../prelude/await-all';
import { types, bool, SchemaType } from '../../misc/schema';

export type PackedDriveFile = SchemaType<typeof packedDriveFileSchema>;

@EntityRepository(DriveFile)
export class DriveFileRepository extends Repository<DriveFile> {
	public validateFileName(name: string): boolean {
		return (
			(name.trim().length > 0) &&
			(name.length <= 200) &&
			(name.indexOf('\\') === -1) &&
			(name.indexOf('/') === -1) &&
			(name.indexOf('..') === -1)
		);
	}

	public getPublicUrl(file: DriveFile, thumbnail = false): string | null {
		return thumbnail ? (file.thumbnailUrl || file.webpublicUrl || null) : (file.webpublicUrl || file.url);
	}

	public async clacDriveUsageOf(user: User['id'] | User): Promise<number> {
		const id = typeof user === 'object' ? user.id : user;

		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userId = :id', { id: id })
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	}

	public async clacDriveUsageOfHost(host: string): Promise<number> {
		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userHost = :host', { host: toPuny(host) })
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	}

	public async clacDriveUsageOfLocal(): Promise<number> {
		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userHost IS NULL')
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	}

	public async clacDriveUsageOfRemote(): Promise<number> {
		const { sum } = await this
			.createQueryBuilder('file')
			.where('file.userHost IS NOT NULL')
			.select('SUM(file.size)', 'sum')
			.getRawOne();

		return parseInt(sum, 10) || 0;
	}

	public async pack(
		src: DriveFile['id'] | DriveFile,
		options?: {
			detail?: boolean,
			self?: boolean,
			withUser?: boolean,
		}
	): Promise<PackedDriveFile> {
		const opts = Object.assign({
			detail: false,
			self: false
		}, options);

		const file = typeof src === 'object' ? src : await this.findOne(src).then(ensure);

		return await awaitAll({
			id: file.id,
			createdAt: file.createdAt.toISOString(),
			name: file.name,
			type: file.type,
			md5: file.md5,
			size: file.size,
			isSensitive: file.isSensitive,
			properties: file.properties,
			url: opts.self ? file.url : this.getPublicUrl(file, false),
			thumbnailUrl: this.getPublicUrl(file, true),
			folderId: file.folderId,
			folder: opts.detail && file.folderId ? DriveFolders.pack(file.folderId, {
				detail: true
			}) : null,
			user: opts.withUser ? Users.pack(file.userId!) : null
		});
	}

	public packMany(
		files: any[],
		options?: {
			detail?: boolean
			self?: boolean,
			withUser?: boolean,
		}
	) {
		return Promise.all(files.map(f => this.pack(f, options)));
	}
}

export const packedDriveFileSchema = {
	type: types.object,
	optional: bool.false, nullable: bool.false,
	properties: {
		id: {
			type: types.string,
			optional: bool.false, nullable: bool.false,
			format: 'id',
			description: 'The unique identifier for this Drive file.',
			example: 'xxxxxxxxxx',
		},
		createdAt: {
			type: types.string,
			optional: bool.false, nullable: bool.false,
			format: 'date-time',
			description: 'The date that the Drive file was created on Misskey.'
		},
		name: {
			type: types.string,
			optional: bool.false, nullable: bool.false,
			description: 'The file name with extension.',
			example: 'lenna.jpg'
		},
		type: {
			type: types.string,
			optional: bool.false, nullable: bool.false,
			description: 'The MIME type of this Drive file.',
			example: 'image/jpeg'
		},
		md5: {
			type: types.string,
			optional: bool.false, nullable: bool.false,
			format: 'md5',
			description: 'The MD5 hash of this Drive file.',
			example: '15eca7fba0480996e2245f5185bf39f2'
		},
		size: {
			type: types.number,
			optional: bool.false, nullable: bool.false,
			description: 'The size of this Drive file. (bytes)',
			example: 51469
		},
		url: {
			type: types.string,
			optional: bool.false, nullable: bool.true,
			format: 'url',
			description: 'The URL of this Drive file.',
		},
		folderId: {
			type: types.string,
			optional: bool.false, nullable: bool.true,
			format: 'id',
			description: 'The parent folder ID of this Drive file.',
			example: 'xxxxxxxxxx',
		},
		isSensitive: {
			type: types.boolean,
			optional: bool.false, nullable: bool.false,
			description: 'Whether this Drive file is sensitive.',
		},
	},
};
