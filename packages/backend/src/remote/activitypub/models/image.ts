/**
 * @packageDocumentation
 *
 * ActivityPub の Image オブジェクトの作成・解決
 *
 * @remarks
 * - **役割**: リモートノートの添付画像をドライブに取り込み、Image オブジェクトを解決する。
 *
 * @see {@link services/drive/upload-from-url} URL からアップロード
 * @internal
 */
import { uploadFromUrl } from "@/services/drive/upload-from-url.js";
import type { CacheableRemoteUser } from "@/models/entities/user.js";
import { IRemoteUser } from "@/models/entities/user.js";
import Resolver from "../resolver.js";
import { fetchMeta } from "@/misc/fetch-meta.js";
import { apLogger } from "../logger.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { DriveFiles, Users } from "@/models/index.js";
import { truncate } from "@/misc/truncate.js";
import { DB_MAX_IMAGE_COMMENT_LENGTH } from "@/misc/hard-limits.js";
import { isDocument, type IObject } from '../type.js';

const logger = apLogger;

/**
 * Image を作成する。
 */
export async function createImage(
	actor: CacheableRemoteUser,
	value: any,
): Promise<DriveFile> {
	// 作者が凍結されている場合はスキップ
	if (actor.isSuspended) {
		throw new Error("actor has been suspended");
	}

	const image = (await new Resolver().resolve(value)) as any;
	
	if (!isDocument(image)) return null;

	if (image.url == null) {
		return null;
	}

	if (!image.url.startsWith("https://") && !image.url.startsWith("http://")) {
		return null;
	}

	logger.info(`Creating the Image: ${image.url}`);

	const instance = await fetchMeta();

	let file = await uploadFromUrl({
		url: image.url,
		user: actor,
		uri: image.url,
		sensitive: image.sensitive,
		isLink: !instance.cacheRemoteFiles,
		comment: truncate(image.name, DB_MAX_IMAGE_COMMENT_LENGTH),
	});

	if (file.isLink) {
		// URL が異なる場合は、同一画像が別 URL で登録されていたため URL を更新する
		if (file.url !== image.url) {
			await DriveFiles.update(
				{ id: file.id },
				{
					url: image.url,
					uri: image.url,
				},
			);

			file = await DriveFiles.findOneByOrFail({ id: file.id });
		}
	}

	return file;
}

/**
 * Image を解決する。
 *
 * 対象の Image が Calckey に登録されていればそれを返し、
 * そうでなければリモートから取得して Calckey に登録して返す。
 */
export async function resolveImage(
	actor: CacheableRemoteUser,
	value: any,
): Promise<DriveFile> {
	// TODO

	// リモートから取得して登録
	return await createImage(actor, value);
}
