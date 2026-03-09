import { db } from "@/db/postgre.js";
import { DriveFile } from "@/models/entities/drive-file.js";
import type { User } from "@/models/entities/user.js";
import { toPuny } from "@/misc/convert-host.js";
import { awaitAll, Promiseable } from "@/prelude/await-all.js";
import type { Packed } from "@/misc/schema.js";
import config from "@/config/index.js";
import { query, appendQuery } from "@/prelude/url.js";
import { Meta } from "@/models/entities/meta.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { In } from "typeorm";
import { Users, DriveFolders } from "../index.js";
import { deepClone } from "@/misc/clone.js";

type PackOptions = {
	detail?: boolean;
	self?: boolean;
	withUser?: boolean;
};

export const DriveFileRepository = db.getRepository(DriveFile).extend({
	validateFileName(name: string): boolean {
		return (
			name.trim().length > 0 &&
			name.length <= 200 &&
			name.indexOf("\\") === -1 &&
			name.indexOf("/") === -1 &&
			name.indexOf("..") === -1
		);
	},

	getPublicProperties(file: DriveFile): DriveFile["properties"] {
		if (file.properties.orientation != null) {
			const properties = deepClone(file.properties);
			if (file.properties.orientation >= 5) {
				[properties.width, properties.height] = [
					properties.height,
					properties.width,
				];
			}
			properties.orientation = undefined;
			return properties;
		}

		return file.properties;
	},

	getPublicUrl(file: DriveFile, thumbnail = false, original = false): string | null {
		// リモートかつメディアプロキシ
		if (
			file.uri != null &&
			file.userHost != null &&
			config.mediaProxy != null
		) {
			return appendQuery(
				config.mediaProxy,
				query({
					url: file.uri,
					thumbnail: thumbnail ? "1" : undefined,
				}),
			);
		}

		// リモートかつ期限切れはローカルプロキシを試みる
		if (file.uri != null && file.isLink && config.proxyRemoteFiles) {
			const key = thumbnail ? file.thumbnailAccessKey : file.webpublicAccessKey;

			if (key && !key.match("/")) {
				// 古いものはここにオブジェクトストレージキーが入ってるので除外
				return `${config.url}/files/${key}`;
			}
		}

		const isImage =
			file.type &&
			[
				"image/png",
				"image/apng",
				"image/gif",
				"image/jpeg",
				"image/vnd.mozilla.apng",
				"image/webp",
				"image/svg+xml",
				"image/avif",
			].includes(file.type);

		const url = original
			? file.webpublicUrl && file.url ? file.url : null
			: thumbnail
				? file.thumbnailUrl || (isImage ? file.webpublicUrl || file.url : null)
				: file.webpublicUrl || file.url;

		return url?.replace(
			"s3.arkjp.net",
			"media.misskeyusercontent.jp",
		)?.replace(
			"media.misskeyusercontent.com",
			"media.misskeyusercontent.jp",
		) ?? null;
	},

	async calcDriveUsageOf(
		user: User["id"] | { id: User["id"] },
	): Promise<number> {
		const id = typeof user === "object" ? user.id : user;

		const { sum } = await this.createQueryBuilder("file")
			.where("file.userId = :id", { id: id })
			.andWhere("file.isLink = FALSE")
			.select("SUM(file.size)", "sum")
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async calcDriveUsageOfHost(host: string): Promise<number> {
		const { sum } = await this.createQueryBuilder("file")
			.where("file.userHost = :host", { host: toPuny(host) })
			.andWhere("file.isLink = FALSE")
			.select("SUM(file.size)", "sum")
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async calcDriveUsageOfLocal(): Promise<number> {
		const { sum } = await this.createQueryBuilder("file")
			.where("file.userHost IS NULL")
			.andWhere("file.isLink = FALSE")
			.select("SUM(file.size)", "sum")
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async calcDriveUsageOfRemote(): Promise<number> {
		const { sum } = await this.createQueryBuilder("file")
			.where("file.userHost IS NOT NULL")
			.andWhere("file.isLink = FALSE")
			.select("SUM(file.size)", "sum")
			.getRawOne();

		return parseInt(sum, 10) || 0;
	},

	async pack(
		src: DriveFile["id"] | DriveFile,
		options?: PackOptions,
	): Promise<Packed<"DriveFile">> {
		const opts = Object.assign(
			{
				detail: false,
				self: false,
			},
			options,
		);

		const file =
			typeof src === "object" ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll<Packed<"DriveFile">>({
			id: file.id,
			createdAt: file.createdAt.toISOString(),
			name: file.name,
			type: file.type,
			md5: file.md5,
			size: file.size,
			isSensitive: file.isSensitive,
			blurhash: file.blurhash,
			properties: opts.self ? file.properties : this.getPublicProperties(file),
			url: opts.self ? file.url : this.getPublicUrl(file, false),
			thumbnailUrl: this.getPublicUrl(file, true),
                        originalUrl: this.getPublicUrl(file, false, true),
                        comment: file.comment,
                        folderId: file.folderId,
                        folder:
                                opts.detail && file.folderId
                                        ? DriveFolders.pack(file.folderId, {
							detail: true,
					  })
					: null,
			userId: opts.withUser ? file.userId : null,
			user: opts.withUser && file.userId ? Users.pack(file.userId) : null,
		});
	},

	async packNullable(
		src: DriveFile["id"] | DriveFile,
		options?: PackOptions,
	): Promise<Packed<"DriveFile"> | null> {
		const opts = Object.assign(
			{
				detail: false,
				self: false,
			},
			options,
		);

		const file =
			typeof src === "object" ? src : await this.findOneBy({ id: src });
		if (file == null) return null;

		return await awaitAll<Packed<"DriveFile">>({
			id: file.id,
			createdAt: file.createdAt.toISOString(),
			name: file.name,
			type: file.type,
			md5: file.md5,
			size: file.size,
			isSensitive: file.isSensitive,
			blurhash: file.blurhash,
			properties: opts.self ? file.properties : this.getPublicProperties(file),
			url: opts.self ? file.url : this.getPublicUrl(file, false),
			thumbnailUrl: this.getPublicUrl(file, true),
                        originalUrl: this.getPublicUrl(file, false, true),
                        comment: file.comment,
                        folderId: file.folderId,
                        folder:
                                opts.detail && file.folderId
                                        ? DriveFolders.pack(file.folderId, {
							detail: true,
					  })
					: null,
			userId: opts.withUser ? file.userId : null,
			user: opts.withUser && file.userId ? Users.pack(file.userId) : null,
		});
	},

        async packMany(
                files: (DriveFile["id"] | DriveFile)[],
                options?: PackOptions,
        ): Promise<Packed<"DriveFile">[]> {
                if (files.length === 0) return [];

                const idsToFetch = new Set<DriveFile["id"]>();
                const providedFiles = new Map<DriveFile["id"], DriveFile>();

                for (const file of files) {
                        if (typeof file === "object") {
                                providedFiles.set(file.id, file);
                                idsToFetch.delete(file.id);
                        } else if (!providedFiles.has(file)) {
                                idsToFetch.add(file);
                        }
                }

                const fetchedFiles =
                        idsToFetch.size > 0
                                ? await this.findBy({ id: In([...idsToFetch]) })
                                : [];

                for (const file of fetchedFiles) {
                        if (!providedFiles.has(file.id)) {
                                providedFiles.set(file.id, file);
                        }
                }

                const items = await Promise.all(
                        files.map((file) => {
                                if (typeof file === "object") {
                                        return this.packNullable(file, options);
                                }

                                const resolved = providedFiles.get(file);
                                return resolved
                                        ? this.packNullable(resolved, options)
                                        : Promise.resolve(null);
                        }),
                );

                return items.filter((x): x is Packed<"DriveFile"> => x != null);
        },

        async adjustUsageCount(
                fileIds: DriveFile["id"][],
                delta: number,
        ): Promise<void> {
                const uniqueIds = [...new Set(fileIds)].filter((id) => id != null);
                if (uniqueIds.length === 0 || delta === 0) return;

                const qb = this.createQueryBuilder()
                        .update()
                        .whereInIds(uniqueIds);

                if (delta > 0) {
                        await qb
                                .set({ usageCount: () => '"usageCount" + :delta' })
                                .setParameters({ delta })
                                .execute();
                } else {
                        await qb
                                .set({
                                        usageCount: () =>
                                                'GREATEST("usageCount" + :delta, 0)',
                                })
                                .setParameters({ delta })
                                .execute();
                }
        },
});
