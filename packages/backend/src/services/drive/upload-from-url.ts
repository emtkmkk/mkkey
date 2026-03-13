/**
 * @packageDocumentation
 *
 * URL からドライブへファイルをアップロードするサービス。
 *
 * @remarks
 * - **役割**: 指定 URL からファイルを取得し、addFile でドライブに保存する。drive/files/upload-from-url 等から呼ばれる。
 *
 * @see {@link drive/add-file} ファイル追加
 * @internal
 */
import { URL } from "node:url";
import type { User } from "@/models/entities/user.js";
import { createTemp } from "@/misc/create-temp.js";
import { downloadUrl, isPrivateIp } from "@/misc/download-url.js";
import type { DriveFolder } from "@/models/entities/drive-folder.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { DriveFiles } from "@/models/index.js";
import { driveLogger } from "./logger.js";
import { addFile } from "./add-file.js";

const logger = driveLogger.createSubLogger("downloader");

type Args = {
	url: string;
	user: { id: User["id"]; host: User["host"] } | null;
	folderId?: DriveFolder["id"] | null;
	uri?: string | null;
	sensitive?: boolean;
	force?: boolean;
	isLink?: boolean;
	comment?: string | null;
	requestIp?: string | null;
	requestHeaders?: Record<string, string> | null;
};

export async function uploadFromUrl({
	url,
	user,
	folderId = null,
	uri = null,
	sensitive = false,
	force = false,
	isLink = false,
	comment = null,
	requestIp = null,
	requestHeaders = null,
}: Args): Promise<DriveFile> {
	const parsedUrl = new URL(url);
	if (
		process.env.NODE_ENV === "production" &&
		isPrivateIp(parsedUrl.hostname.replaceAll(/(\[)|(\])/g, ""))
	) {
		throw new Error("Private IP is not allowed");
	}

	let name = parsedUrl.pathname.split("/").pop() || null;
	if (name == null || !DriveFiles.validateFileName(name)) {
		name = null;
	}

	// コメントが名前と同じ場合はコメントを省略（添付受信時に image.name が渡される場合）
	if (comment !== null && name === comment) {
		comment = null;
	}

	// 一時ファイルを作成
	const [path, cleanup] = await createTemp();

	try {
		// URL の内容を一時ファイルに書き出す
		await downloadUrl(url, path);

		const driveFile = await addFile({
			user,
			path,
			name,
			comment,
			folderId,
			force,
			isLink,
			url,
			uri,
			sensitive,
			requestIp,
			requestHeaders,
		});
		logger.succ(`Got: ${driveFile.id}`);
		return driveFile!;
	} catch (e) {
		logger.error(`Failed to create drive file: ${e}`, {
			url: url,
			e: e,
		});
		throw e;
	} finally {
		cleanup();
	}
}
