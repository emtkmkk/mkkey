import * as fs from "node:fs";

import { v4 as uuid } from "uuid";

import type S3 from "aws-sdk/clients/s3.js";
import sharp from "sharp";
import { sharpBmp } from "@misskey-dev/sharp-read-bmp";
import { IsNull } from "typeorm";
import { publishMainStream, publishDriveStream } from "@/services/stream.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { contentDisposition } from "@/misc/content-disposition.js";
import { getFileInfo, getBlurhashBuffer } from "@/misc/get-file-info.js";
import {
	DriveFiles,
	DriveFolders,
	Users,
	Instances,
	UserProfiles,
} from "@/models/index.js";
import { DriveFile } from "@/models/entities/drive-file.js";
import type { IRemoteUser, User } from "@/models/entities/user.js";
import {
	driveChart,
	perUserDriveChart,
	instanceChart,
} from "@/services/chart/index.js";
import { genId } from "@/misc/gen-id.js";
import { isDuplicateKeyValueError } from "@/misc/is-duplicate-key-value-error.js";
import { FILE_TYPE_BROWSERSAFE } from "@/const.js";
import { IdentifiableError } from "@/misc/identifiable-error.js";
import { getS3 } from "./s3.js";
import { InternalStorage } from "./internal-storage.js";
import type { IImage } from "./image-processor.js";
import { convertSharpToWebp } from "./image-processor.js";
import { driveLogger } from "./logger.js";
import { GenerateVideoThumbnail } from "./generate-video-thumbnail.js";
import { deleteFile } from "./delete-file.js";

const logger = driveLogger.createSubLogger("register", "yellow");

type PathPartLike = string | null;

// Joins an array of elements into a URL pathname, possibly with a base URL object to append to.
// Null or 0-length parts will be left out.
function urlPathJoin(
	baseOrParts: URL | PathPartLike[],
	pathParts?: PathPartLike[],
): string {
	if (baseOrParts instanceof URL) {
		const url = new URL(baseOrParts as URL);
		if (pathParts) {
			pathParts.unshift(
				url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname,
			);
			url.pathname = pathParts
				.filter((x) => x !== null && x.toString().length > 0)
				.join("/");
		}
		return url.toString();
	}
	const baseParts = baseOrParts.concat(pathParts ?? []);
	return baseParts
		.filter((x) => x !== null && x.toString().length > 0)
		.join("/");
}

/***
 * Save file
 * @param path Path for original
 * @param name Name for original
 * @param type Content-Type for original
 * @param hash Hash for original
 * @param size Size for original
 */
async function save(
	file: DriveFile,
	path: string,
	name: string,
	type: string,
	hash: string,
	size: number,
): Promise<DriveFile> {
	// thunbnail, webpublic を必要なら生成
	const alts = await generateAlts(path, type, !file.uri);

	const meta = await fetchMeta();

	if (meta.useObjectStorage) {
		//#region ObjectStorage params
		let [ext] = name.match(/\.([a-zA-Z0-9_-]+)$/) || [""];

		if (ext === "") {
			if (type === "image/jpeg") ext = ".jpg";
			if (type === "image/png") ext = ".png";
			if (type === "image/webp") ext = ".webp";
			if (type === "image/apng") ext = ".apng";
			if (type === "image/avif") ext = ".avif";
			if (type === "image/bmp") ext = ".bmp";
			if (type === "image/vnd.mozilla.apng") ext = ".apng";
		}

		// Some cloud providers (notably upcloud) will infer the content-type based
		// on extension, so we remove extensions from non-browser-safe types.
		if (!FILE_TYPE_BROWSERSAFE.includes(type)) {
			ext = "";
		}

		const baseUrl = new URL(
			meta.objectStorageBaseUrl ?? `/${meta.objectStorageBucket}`,
			`${meta.objectStorageUseSSL ? "https" : "http"}://${
				meta.objectStorageEndpoint
			}${meta.objectStoragePort ? `:${meta.objectStoragePort}` : ""}`,
		);

		// for original
		const key = urlPathJoin([meta.objectStoragePrefix, `${uuid()}${ext}`]);
		const url = urlPathJoin(baseUrl, [key]);

		// for alts
		let webpublicKey: string | null = null;
		let webpublicUrl: string | null = null;
		let thumbnailKey: string | null = null;
		let thumbnailUrl: string | null = null;
		//#endregion

		//#region Uploads
		logger.info(`uploading original: ${key}`);
		const uploads = [upload(key, fs.createReadStream(path), type, name)];

		if (alts.webpublic) {
			webpublicKey = urlPathJoin([
				meta.objectStoragePrefix,
				`webpublic-${uuid()}.${alts.webpublic.ext}`,
			]);
			webpublicUrl = urlPathJoin(baseUrl, [webpublicKey]);

			logger.info(`uploading webpublic: ${webpublicKey}`);
			uploads.push(
				upload(webpublicKey, alts.webpublic.data, alts.webpublic.type, name),
			);
		}

		if (alts.thumbnail) {
			thumbnailKey = urlPathJoin([
				meta.objectStoragePrefix,
				`thumbnail-${uuid()}.${alts.thumbnail.ext}`,
			]);
			thumbnailUrl = urlPathJoin(baseUrl, [thumbnailKey]);

			logger.info(`uploading thumbnail: ${thumbnailKey}`);
			uploads.push(
				upload(thumbnailKey, alts.thumbnail.data, alts.thumbnail.type),
			);
			if (!file.blurhash) {
				// もしBlurhashがまだ生成されていない場合は、サムネイル画像を用いて再度生成する
				file.blurhash = await getBlurhashBuffer(alts.thumbnail.data).catch(
					(e) => {
						console.log(`getBlurhash to thumbnail failed: ${e}`);
						return null;
					},
				);
			}
		}

		await Promise.all(uploads);
		//#endregion

		file.url = url;
		file.thumbnailUrl = thumbnailUrl;
		file.webpublicUrl = webpublicUrl;
		file.accessKey = key;
		file.thumbnailAccessKey = thumbnailKey;
		file.webpublicAccessKey = webpublicKey;
		file.webpublicType = alts.webpublic?.type ?? null;
		file.name = name;
		file.type = type;
		file.md5 = hash;
		file.size = size;
		file.storedInternal = false;

		return await DriveFiles.insert(file).then((x) =>
			DriveFiles.findOneByOrFail(x.identifiers[0]),
		);
	} else {
		// use internal storage
		const accessKey = uuid();
		const thumbnailAccessKey = `thumbnail-${uuid()}`;
		const webpublicAccessKey = `webpublic-${uuid()}`;

		const url = InternalStorage.saveFromPath(accessKey, path);

		let thumbnailUrl: string | null = null;
		let webpublicUrl: string | null = null;

		if (alts.thumbnail) {
			thumbnailUrl = InternalStorage.saveFromBuffer(
				thumbnailAccessKey,
				alts.thumbnail.data,
			);
			logger.info(`thumbnail stored: ${thumbnailAccessKey}`);
		}

		if (alts.webpublic) {
			webpublicUrl = InternalStorage.saveFromBuffer(
				webpublicAccessKey,
				alts.webpublic.data,
			);
			logger.info(`web stored: ${webpublicAccessKey}`);
		}

		file.storedInternal = true;
		file.url = url;
		file.thumbnailUrl = thumbnailUrl;
		file.webpublicUrl = webpublicUrl;
		file.accessKey = accessKey;
		file.thumbnailAccessKey = thumbnailAccessKey;
		file.webpublicAccessKey = webpublicAccessKey;
		file.webpublicType = alts.webpublic?.type ?? null;
		file.name = name;
		file.type = type;
		file.md5 = hash;
		file.size = size;

		return await DriveFiles.insert(file).then((x) =>
			DriveFiles.findOneByOrFail(x.identifiers[0]),
		);
	}
}

/**
 * Generate webpublic, thumbnail, etc
 * @param path Path for original
 * @param type Content-Type for original
 * @param generateWeb Generate webpublic or not
 */
export async function generateAlts(
	path: string,
	type: string,
	generateWeb: boolean,
) {
	if (type.startsWith("video/")) {
		try {
			const thumbnail = await GenerateVideoThumbnail(path);
			return {
				webpublic: null,
				thumbnail,
			};
		} catch (err) {
			logger.warn(`GenerateVideoThumbnail failed: ${err}`);
			return {
				webpublic: null,
				thumbnail: null,
			};
		}
	}

	if (
		![
			"image/jpeg",
			"image/png",
			"image/webp",
			"image/svg+xml",
			"image/avif",
			"image/bmp",
		].includes(type)
	) {
		logger.debug("web image and thumbnail not created (not an required file)");
		return {
			webpublic: null,
			thumbnail: null,
		};
	}

	let img: sharp.Sharp | null = null;
	let satisfyWebpublic: boolean;

	try {
		img = await sharpBmp(path, type);
		const metadata = await img.metadata();
		const isAnimated = metadata.pages && metadata.pages > 1;

		// skip animated
		if (isAnimated) {
			return {
				webpublic: null,
				thumbnail: null,
			};
		}

		satisfyWebpublic = !!(
			type !== "image/svg+xml" &&
			type !== "image/webp" &&
			!(
				metadata.exif ||
				metadata.iptc ||
				metadata.xmp ||
				metadata.tifftagPhotoshop
			) &&
			metadata.width &&
			metadata.width <= 524288 &&
			metadata.height &&
			metadata.height <= 524288 &&
			metadata.width * metadata.height <= 2048 * 2048
		);
	} catch (err) {
		logger.warn(`sharp failed: ${err}`);
		return {
			webpublic: null,
			thumbnail: null,
		};
	}

	// #region webpublic
	let webpublic: IImage | null = null;

	if (generateWeb && !satisfyWebpublic) {
		logger.info("creating web image");

		try {
			if (["image/jpeg"].includes(type)) {
				webpublic = await convertSharpToWebp(img, 2048, 2048);
			} else if (["image/webp"].includes(type)) {
				webpublic = await convertSharpToWebp(img, 2048, 2048);
			} else if (["image/png"].includes(type)) {
				webpublic = await convertSharpToWebp(img, 2048, 2048, 100);
			} else if (["image/svg+xml"].includes(type)) {
				webpublic = await convertSharpToWebp(img, 2048, 2048);
			} else if (["image/bmp"].includes(type)) {
				webpublic = await convertSharpToWebp(img, 2048, 2048);
			} else {
				logger.debug("web image not created (not an required image)");
			}
		} catch (err) {
			logger.warn("web image not created (an error occured)", err as Error);
		}
	} else {
		if (satisfyWebpublic)
			logger.info("web image not created (original satisfies webpublic)");
		else logger.info("web image not created (from remote)");
	}
	// #endregion webpublic

	// #region thumbnail
	let thumbnail: IImage | null = null;

	try {
		if (
			[
				"image/jpeg",
				"image/webp",
				"image/png",
				"image/svg+xml",
				"image/avif",
				"image/bmp",
			].includes(type)
		) {
			thumbnail = await convertSharpToWebp(img, 996, 560);
		} else {
			logger.debug("thumbnail not created (not an required file)");
		}
	} catch (err) {
		logger.warn("thumbnail not created (an error occured)", err as Error);
	}
	// #endregion thumbnail

	return {
		webpublic,
		thumbnail,
	};
}

/**
 * Upload to ObjectStorage
 */
async function upload(
	key: string,
	stream: fs.ReadStream | Buffer,
	type: string,
	filename?: string,
) {
	if (type === "image/apng") type = "image/png";
	if (!FILE_TYPE_BROWSERSAFE.includes(type)) type = "application/octet-stream";

	const meta = await fetchMeta();

	const params = {
		Bucket: meta.objectStorageBucket,
		Key: key,
		Body: stream,
		ContentType: type,
		CacheControl: "max-age=31536000, immutable",
	} as S3.PutObjectRequest;

	if (filename)
		params.ContentDisposition = contentDisposition("inline", filename);
	if (meta.objectStorageSetPublicRead) params.ACL = "public-read";

	const s3 = getS3(meta);

	const upload = s3.upload(params, {
		partSize:
			s3.endpoint.hostname === "storage.googleapis.com"
				? 500 * 1024 * 1024
				: 8 * 1024 * 1024,
	});

	const result = await upload.promise();
	if (result)
		logger.debug(
			`Uploaded: ${result.Bucket}/${result.Key} => ${result.Location}`,
		);
}

async function expireOldFile(user: IRemoteUser, driveCapacity: number) {
	const q = DriveFiles.createQueryBuilder("file")
		.where("file.userId = :userId", { userId: user.id })
		.andWhere("file.isLink = FALSE");

	if (user.avatarId) {
		q.andWhere("file.id != :avatarId", { avatarId: user.avatarId });
	}

	if (user.bannerId) {
		q.andWhere("file.id != :bannerId", { bannerId: user.bannerId });
	}

	//This selete is hard coded, be careful if change database schema
	q.addSelect(
		'SUM("file"."size") OVER (ORDER BY "file"."id" DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)',
		"acc_usage",
	);

	q.orderBy("file.id", "ASC");

	const fileList = await q.getRawMany();
	const exceedFileIds = fileList
		.filter((x: any) => x.acc_usage > driveCapacity)
		.map((x: any) => x.file_id);

	for (const fileId of exceedFileIds) {
		const file = await DriveFiles.findOneBy({ id: fileId });
		deleteFile(file, true);
	}
}

type AddFileArgs = {
	/** User who wish to add file */
	user: {
		id: User["id"];
		username: User["username"];
		host: User["host"];
		driveCapacityOverrideMb: User["driveCapacityOverrideMb"];
	} | null;
	/** File path */
	path: string;
	/** Name */
	name?: string | null;
	/** Comment */
	comment?: string | null;
	/** Folder ID */
	folderId?: any;
	/** If set to true, forcibly upload the file even if there is a file with the same hash. */
	force?: boolean;
	/** Do not save file to local */
	isLink?: boolean;
	/** URL of source (URLからアップロードされた場合(ローカル/リモート)の元URL) */
	url?: string | null;
	/** URL of source (リモートインスタンスのURLからアップロードされた場合の元URL) */
	uri?: string | null;
	/** Mark file as sensitive */
	sensitive?: boolean | null;

	requestIp?: string | null;
	requestHeaders?: Record<string, string> | null;
};

/**
 * Add file to drive
 *
 */
export async function addFile({
	user,
	path,
	name = null,
	comment = null,
	folderId = null,
	force = false,
	isLink = false,
	url = null,
	uri = null,
	sensitive = null,
	requestIp = null,
	requestHeaders = null,
}: AddFileArgs): Promise<DriveFile> {
	let skipNsfwCheck = false;
	const instance = await fetchMeta();
	if (user == null) skipNsfwCheck = true;
	if (instance.sensitiveMediaDetection === "none") skipNsfwCheck = true;
	if (
		user &&
		instance.sensitiveMediaDetection === "local" &&
		Users.isRemoteUser(user)
	)
		skipNsfwCheck = true;
	if (
		user &&
		instance.sensitiveMediaDetection === "remote" &&
		Users.isLocalUser(user)
	)
		skipNsfwCheck = true;

	const info = await getFileInfo(path, {
		skipSensitiveDetection: skipNsfwCheck,
		sensitiveThreshold: // 感度が高いほどしきい値は低くすることになる
			instance.sensitiveMediaDetectionSensitivity === "veryHigh"
				? 0.1
				: instance.sensitiveMediaDetectionSensitivity === "high"
				? 0.3
				: instance.sensitiveMediaDetectionSensitivity === "low"
				? 0.7
				: instance.sensitiveMediaDetectionSensitivity === "veryLow"
				? 0.9
				: 0.5,
		sensitiveThresholdForPorn: 0.75,
		enableSensitiveMediaDetectionForVideos:
			instance.enableSensitiveMediaDetectionForVideos,
	});
	logger.info(`${JSON.stringify(info)}`);

	// 現状 false positive が多すぎて実用に耐えない
	//if (info.porn && instance.disallowUploadWhenPredictedAsPorn) {
	//	throw new IdentifiableError('282f77bf-5816-4f72-9264-aa14d8261a21', 'Detected as porn.');
	//}

	// detect name
	const detectedName =
		name ||
		(info.type.ext
			? `${user.username}${
					user.host ? `-${user.host.replaceAll(/\W+/, "_")}` : ""
			  }-${uuid()}.${info.type.ext}`
			: "untitled");

	if (user && !force) {
		// Check if there is a file with the same hash
		const much = await DriveFiles.findOneBy({
			md5: info.md5,
			userId: user.id,
		});

		if (much) {
			logger.info(`file with same hash is found: ${much.id}`);
			return much;
		}
	}

	//#region Check drive usage
	if (user && !isLink) {
		const usage = await DriveFiles.calcDriveUsageOf(user);
		const u = await Users.findOneBy({ id: user.id });

		const instance = await fetchMeta();
		let driveCapacity =
			1024 *
			1024 *
			(Users.isLocalUser(user)
				? instance.localDriveCapacityMb
				: instance.remoteDriveCapacityMb);

		if (Users.isLocalUser(user) && u?.driveCapacityOverrideMb != null) {
			driveCapacity = 1024 * 1024 * u.driveCapacityOverrideMb;
			logger.debug("drive capacity override applied");
			logger.debug(
				`overrideCap: ${driveCapacity}bytes, usage: ${usage}bytes, u+s: ${
					usage + info.size
				}bytes`,
			);
		}

		logger.debug(`drive usage is ${usage} (max: ${driveCapacity})`);

		// If usage limit exceeded
		if (usage + info.size > driveCapacity) {
			if (Users.isLocalUser(user)) {
				throw new IdentifiableError(
					"c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6",
					"No free space.",
				);
			} else {
				// (アバターまたはバナーを含まず)最も古いファイルを削除する
				expireOldFile(
					(await Users.findOneByOrFail({ id: user.id })) as IRemoteUser,
					driveCapacity - info.size,
				);
			}
		}
	}
	//#endregion

	const fetchFolder = async () => {
		if (!folderId) {
			return null;
		}

		const driveFolder = await DriveFolders.findOneBy({
			id: folderId,
			userId: user ? user.id : IsNull(),
		});

		if (driveFolder == null) throw new Error("folder-not-found");

		return driveFolder;
	};

	const properties: {
		width?: number;
		height?: number;
		orientation?: number;
	} = {};

	if (info.width) {
		properties["width"] = info.width;
		properties["height"] = info.height;
	}
	if (info.orientation != null) {
		properties["orientation"] = info.orientation;
	}

	const profile = user
		? await UserProfiles.findOneBy({ userId: user.id })
		: null;

	const folder = await fetchFolder();

	let file = new DriveFile();
	file.id = genId();
	file.createdAt = new Date();
	file.userId = user ? user.id : null;
	file.userHost = user ? user.host : null;
	file.folderId = folder !== null ? folder.id : null;
	file.comment = comment;
	file.properties = properties;
	file.blurhash = info.blurhash || null;
	file.isLink = isLink;
	file.requestIp = requestIp;
	file.requestHeaders = requestHeaders;
	file.maybeSensitive = info.sensitive;
	file.maybePorn = info.porn;
	file.isSensitive = user
		? Users.isLocalUser(user) && profile!.alwaysMarkNsfw
			? true
			: sensitive !== null && sensitive !== undefined
			? sensitive
			: false
		: false;

	if (info.sensitive && profile!.autoSensitive) file.isSensitive = true;
	if (info.sensitive && instance.setSensitiveFlagAutomatically)
		file.isSensitive = true;

	if (url !== null) {
		file.src = url;

		if (isLink) {
			file.url = url;
			// ローカルプロキシ用
			file.accessKey = uuid();
			file.thumbnailAccessKey = `thumbnail-${uuid()}`;
			file.webpublicAccessKey = `webpublic-${uuid()}`;
		}
	}

	if (uri !== null) {
		file.uri = uri;
	}

	if (isLink) {
		try {
			file.size = 0;
			file.md5 = info.md5;
			file.name = detectedName;
			file.type = info.type.mime;
			file.storedInternal = false;

			file = await DriveFiles.insert(file).then((x) =>
				DriveFiles.findOneByOrFail(x.identifiers[0]),
			);
		} catch (err) {
			// duplicate key error (when already registered)
			if (isDuplicateKeyValueError(err)) {
				logger.info(`already registered ${file.uri}`);

				file = (await DriveFiles.findOneBy({
					uri: file.uri!,
					userId: user ? user.id : IsNull(),
				})) as DriveFile;
			} else {
				logger.error(err as Error);
				throw err;
			}
		}
	} else {
		file = await save(
			file,
			path,
			detectedName,
			info.type.mime,
			info.md5,
			info.size,
		);
	}

	logger.succ(`drive file has been created ${file.id}`);

	if (user) {
		DriveFiles.pack(file, { self: true }).then((packedFile) => {
			// Publish driveFileCreated event
			publishMainStream(user.id, "driveFileCreated", packedFile);
			publishDriveStream(user.id, "fileCreated", packedFile);
		});
	}

	// 統計を更新
	driveChart.update(file, true);
	if (file.userHost == null) {
		perUserDriveChart.update(file, true);
	}
	if (file.userHost !== null) {
		instanceChart.updateDrive(file, true);
	}

	return file;
}
