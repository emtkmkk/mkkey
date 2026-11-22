/**
 * @packageDocumentation
 *
 * カスタム絵文字インポートジョブ。ZIP から絵文字を読み込み登録する。
 *
 * @remarks
 * - **役割**: インポートキューで実行し、ZIP 内の画像をカスタム絵文字として登録する。
 *
 * @see {@link queue/processors/db/export-custom-emojis} 絵文字エクスポート
 * @internal
 */
import type Bull from "bull";
import * as fs from "node:fs";
import { resolve as resolvePath, sep as pathSep } from "node:path";
import AdmZip from "adm-zip";

import { queueLogger } from "../../logger.js";
import { createTempDir } from "@/misc/create-temp.js";
import { downloadUrl } from "@/misc/download-url.js";
import { DriveFiles, Emojis } from "@/models/index.js";
import type { DbUserImportJobData } from "@/queue/types.js";
import { addFile } from "@/services/drive/add-file.js";
import { genId } from "@/misc/gen-id.js";
import { clearEmojiQueryCache } from "@/misc/emoji-query-cache.js";

const logger = queueLogger.createSubLogger("import-custom-emojis");

/**
 * meta.json に書かれた絵文字のファイル名を、展開先フォルダ内の実ファイルのパスに解決する。
 *
 * @remarks
 * GHSA-h3mq-w9gq-6mwm 相当の対策: `fileName` は ZIP の作成者が自由に書ける値で、
 * 以前は `${outputPath}/${fileName}` をそのまま読んでいた。`../../.config/default.yml` のような名前で
 * サーバー上の任意のファイルを絵文字としてドライブに登録でき、公開 URL から読めてしまった
 * （他所から拾った絵文字パックを取り込むだけでも起きる）。
 * そこで次のものは拒否する。
 * - 文字列でない・空の名前
 * - 展開先フォルダの外を指す名前（絶対パスや `..` を含むもの）
 * - 普通のファイルでないもの（シンボリックリンク・フォルダなど）
 * - 途中のフォルダがリンクで、たどった先が展開先の外になるもの
 *
 * @param outputPath - ZIP を展開したフォルダ
 * @param fileName - meta.json の `fileName`
 * @returns 安全に読めるファイルのパス。拒否した場合は `null`
 * @internal
 */
function resolveEmojiFilePath(
	outputPath: string,
	fileName: unknown,
): string | null {
	if (typeof fileName !== "string" || fileName === "") return null;

	// 展開先フォルダの中に収まっているかを、正規化したパスで比べる
	const root = resolvePath(outputPath);
	const target = resolvePath(root, fileName);
	if (!target.startsWith(root + pathSep)) return null;

	try {
		// lstat はリンクをたどらないので、リンクそのものは isFile() が false になる
		if (!fs.lstatSync(target).isFile()) return null;
		// 途中のフォルダがリンクの場合に備え、実体のパスでも外に出ていないか確かめる
		const realRoot = fs.realpathSync(root);
		if (!fs.realpathSync(target).startsWith(realRoot + pathSep)) return null;
	} catch {
		// 存在しないファイルは取り込めないので拒否する
		return null;
	}

	return target;
}

/**
 * ZIP（エクスポートした絵文字パック）からカスタム絵文字を取り込むジョブ。
 *
 * @remarks
 * TODO: 名前衝突時の動作を選べるようにする
 * FIXME: 展開の完了を待たずに末尾で `done()` を呼んでおり、展開のコールバック内でも再度呼んでいる。
 * そのため展開中のエラーはジョブの失敗として記録されない。
 *
 * @param job - インポートジョブ（`fileId` に ZIP のドライブファイル ID）
 * @param done - Bull の完了コールバック
 * @internal
 */
export async function importCustomEmojis(
	job: Bull.Job<DbUserImportJobData>,
	done: any,
): Promise<void> {
	logger.info("Importing custom emojis ...");
	job.log("info - " + "Importing custom emojis ...");

	const file = await DriveFiles.findOneBy({
		id: job.data.fileId,
	});
	if (file == null) {
		done();
		return;
	}

	const [path, cleanup] = await createTempDir();

	logger.info(`Temp dir is ${path}`);
	job.log("info - " + `Temp dir is ${path}`);

	const destPath = `${path}/emojis.zip`;

	try {
		fs.writeFileSync(destPath, "", "binary");
		await downloadUrl(file.url, destPath);
	} catch (e) {
		// TODO: 何度か再試行
		if (e instanceof Error || typeof e === "string") {
			logger.error(e);
			job.log("error - " + e);
		}
		throw e;
	}

	const outputPath = `${path}/emojis`;
	const unzipStream = fs.createReadStream(destPath);
	const zip = new AdmZip(destPath);
	zip.extractAllToAsync(outputPath, true, false, async (error) => {
		if (error) throw error;
		const metaRaw = fs.readFileSync(`${outputPath}/meta.json`, "utf-8");
		const meta = JSON.parse(metaRaw);

		for (const record of meta.emojis) {
			if (!record.downloaded) continue;
			const emojiInfo = record.emoji;
			const emojiPath = resolveEmojiFilePath(outputPath, record.fileName);
			if (emojiPath == null) {
				// 展開先の外を指す名前などは取り込まない（resolveEmojiFilePath の説明を参照）
				logger.warn(`Skipped emoji with invalid fileName: ${JSON.stringify(record.fileName)}`);
				job.log("warn - " + `Skipped emoji with invalid fileName: ${JSON.stringify(record.fileName)}`);
				continue;
			}
			await Emojis.delete({
				name: emojiInfo.name,
			});
			const driveFile = await addFile({
				user: null,
				path: emojiPath,
				name: record.fileName,
				force: true,
			});
			const emoji = await Emojis.insert({
				id: genId(),
				updatedAt: new Date(),
				name: emojiInfo.name,
				category: emojiInfo.category,
				host: null,
				aliases: emojiInfo.aliases,
				originalUrl: driveFile.url,
				publicUrl: driveFile.webpublicUrl ?? driveFile.url,
				type: driveFile.webpublicType ?? driveFile.type,
				license: emojiInfo.license,
			}).then((x) => Emojis.findOneByOrFail(x.identifiers[0]));
		}

		await clearEmojiQueryCache();

		cleanup();

		logger.succ("Imported");
		job.log("succ - " + "Imported");
		job.progress(100);
		done();
	});
	logger.succ(`Unzipping to ${outputPath}`);
	job.log("succ - " + `Unzipping to ${outputPath}`);
	job.progress(100);
	done();
}
