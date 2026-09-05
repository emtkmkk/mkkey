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
import type { DriveFileProgressReporter } from "@/misc/drive-file-progress.js";
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
	/**
	 * 処理段階の通知先。ダウンロードとその後のドライブ登録の進捗を報告する。
	 */
	onProgress?: DriveFileProgressReporter | null;
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
	onProgress = null,
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
		// NOTE: 依頼したクライアントから見ると、ここは何も起きていないように見える区間。
		// 総サイズが分かるときだけ割合を出し、分からないときは段階だけ知らせる。
		onProgress?.("downloading", null);
		await downloadUrl(url, path, ({ transferred, total }) => {
			onProgress?.(
				"downloading",
				total ? Math.min(100, Math.floor((transferred / total) * 100)) : null,
			);
		});

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
			onProgress,
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
