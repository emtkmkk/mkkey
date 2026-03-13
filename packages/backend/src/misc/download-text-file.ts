/**
 * @packageDocumentation
 *
 * URL 先のテキストファイルを一時ファイルにダウンロードして内容を読み込む。
 *
 * @remarks
 * - **役割**: リモートのテキスト（ライセンス等）を取得する際に一時ファイル経由で読み込む。
 *
 * @internal
 */
import * as fs from "node:fs";
import * as util from "node:util";
import Logger from "@/services/logger.js";
import { createTemp } from "./create-temp.js";
import { downloadUrl } from "./download-url.js";

const logger = new Logger("download-text-file");

/**
 * 指定 URL のテキストを取得する。
 * @param url - 取得元 URL
 * @returns テキスト内容
 * @internal
 */
export async function downloadTextFile(url: string): Promise<string> {
	// 一時ファイルを作成
	const [path, cleanup] = await createTemp();

	logger.info(`一時ファイルは ${path} です`);

	try {
		// URL の内容を一時ファイルに書き出す
		await downloadUrl(url, path);

		const text = await util.promisify(fs.readFile)(path, "utf8");

		return text;
	} finally {
		cleanup();
	}
}
