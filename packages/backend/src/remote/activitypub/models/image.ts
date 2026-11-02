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
 *
 * @remarks
 * - Document 系（Audio / Document / Image / Page / Video）でない、または http(s) の URL を持たない添付は
 *   取り込まず `null` を返す。呼び出し側は `null` を除外する前提。
 * - `url` がオブジェクト（Link など）で届いた場合は従来どおり例外にする（文字列以外の URL は扱えない）。
 *
 * @param actor - 添付の持ち主（リモートユーザー）
 * @param value - Image オブジェクトまたはその URI
 * @returns 取り込んだドライブファイル。取り込み対象外なら `null`
 * @throws 作者が凍結されている、または `url` が文字列でない場合
 * @internal
 */
export async function createImage(
	actor: CacheableRemoteUser,
	value: string | IObject,
): Promise<DriveFile | null> {
	// 作者が凍結されている場合はスキップ
	if (actor.isSuspended) {
		throw new Error("actor has been suspended");
	}

	const image = await new Resolver().resolve(value);

	if (!isDocument(image)) return null;

	if (image.url == null) {
		return null;
	}

	// url は ApObject（文字列 | オブジェクト | 配列）の型だが、ここでは文字列の URL だけを扱う。
	// 文字列以外は従来も startsWith で TypeError になっていたため、明示的に例外にする（挙動は同じ）
	const imageUrl = image.url;
	if (typeof imageUrl !== "string") {
		throw new Error("invalid image: unexpected type of url");
	}

	if (!imageUrl.startsWith("https://") && !imageUrl.startsWith("http://")) {
		return null;
	}

	logger.info(`Creating the Image: ${imageUrl}`);

	const instance = await fetchMeta();

	let file = await uploadFromUrl({
		url: imageUrl,
		user: actor,
		uri: imageUrl,
		sensitive: image.sensitive,
		isLink: !instance.cacheRemoteFiles,
		comment: truncate(image.name, DB_MAX_IMAGE_COMMENT_LENGTH),
	});

	if (file.isLink) {
		// URL が異なる場合は、同一画像が別 URL で登録されていたため URL を更新する
		if (file.url !== imageUrl) {
			await DriveFiles.update(
				{ id: file.id },
				{
					url: imageUrl,
					uri: imageUrl,
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
	value: string | IObject,
): Promise<DriveFile | null> {
	// TODO

	// リモートから取得して登録
	return await createImage(actor, value);
}
