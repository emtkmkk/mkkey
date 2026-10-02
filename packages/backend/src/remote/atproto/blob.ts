/**
 * @packageDocumentation
 *
 * mkkey のドライブのファイルを、自前 PDS の blob（Bluesky に渡す画像）に変換して保存する。
 *
 * @remarks
 * - 今はプロフィールのアイコンとバナーだけに使う。
 * - Bluesky のプロフィールの画像は「PNG か JPEG・1MB 以下」が決まり。ここでは常に JPEG にする
 *   （透明な部分は白で塗る）。動く画像（GIF など）は最初のコマだけになる。
 * - 同じファイル・同じ使い道で前に変換したものがあれば、それを使い回す。プロフィールの更新のたびに変換し直さないため。
 * - レコードに入れる blob の参照（`{ $type: "blob", ref, mimeType, size }`）もここで作る。
 *
 * @see {@link ../../models/entities/atproto-blob.ts} 保存先
 * @internal
 */

import * as fs from "node:fs/promises";
import sharp from "sharp";
import { cidForRawBytes, parseCid } from "@atproto/lex-data";
import type { LexMap } from "@atproto/repo";
import { AtprotoBlobs, DriveFiles } from "@/models/index.js";
import type { AtprotoBlobPurpose } from "@/models/entities/atproto-blob.js";
import type { DriveFile } from "@/models/entities/drive-file.js";
import { InternalStorage } from "@/services/drive/internal-storage.js";
import { createTemp } from "@/misc/create-temp.js";
import { downloadUrl } from "@/misc/download-url.js";

// #region 定数

/** 画像の大きさの上限（Bluesky の決まり。アイコンもバナーも同じ） */
const MAX_BLOB_SIZE = 1_000_000;

/**
 * 使い道ごとの、縮めるときの最大の幅と高さ。
 *
 * @remarks
 * アイコンは正方形で表示される。バナーは 3:1 で表示される。どちらも縦横比は変えずに、この枠に収める。
 */
const MAX_DIMENSIONS: Record<AtprotoBlobPurpose, { width: number; height: number }> = {
	avatar: { width: 1000, height: 1000 },
	banner: { width: 3000, height: 1000 },
};

/** JPEG の画質を、上限に収まるまで順に下げていくときの値 */
const JPEG_QUALITIES = [90, 80, 70, 60];

// #endregion

// #region 公開メソッド

/**
 * ドライブのファイルから blob を用意し、レコードに入れる参照を返す。
 *
 * @remarks
 * - 前に同じファイル・同じ使い道で変換したものがあれば、それを返す（変換しない）。
 * - ファイルが消えている・画像でないときは null を返す（画像なしとして扱う）。
 *
 * @param userId - blob の持ち主（身元のあるローカルユーザー）
 * @param fileId - 変換元のドライブのファイル
 * @param purpose - 使い道
 * @returns blob の参照。画像として使えないファイルのときは null
 * @throws ファイルを読めなかったとき、画像の変換に失敗したとき
 * @internal
 */
export async function prepareImageBlob(
	userId: string,
	fileId: DriveFile["id"],
	purpose: AtprotoBlobPurpose,
): Promise<LexMap | null> {
	// 前に変換したものがあれば使い回す
	const existing = await AtprotoBlobs.findOne({
		where: { userId, sourceFileId: fileId, purpose },
		select: ["cid", "mimeType", "size"],
	});
	if (existing != null) return toBlobRef(existing);

	const file = await DriveFiles.findOneBy({ id: fileId });
	if (file == null || !file.type.startsWith("image/")) return null;

	const source = await readDriveFile(file);
	const content = await convertForBluesky(source, purpose);
	const cid = (await cidForRawBytes(content)).toString();

	// 同じ中身が別のファイルから作られていた場合（同じ画像を上げ直したなど）は、主キーがぶつかるので上書きしない
	await AtprotoBlobs.createQueryBuilder()
		.insert()
		.values({
			userId,
			cid,
			purpose,
			sourceFileId: fileId,
			mimeType: "image/jpeg",
			size: content.length,
			content,
			createdAt: new Date(),
		})
		.orIgnore()
		.execute();

	return toBlobRef({ cid, mimeType: "image/jpeg", size: content.length });
}

/**
 * レコードの中の blob の参照から、CID を文字列で取り出す。
 *
 * @remarks
 * プロフィールを書き直す必要があるかを比べるのに使う。参照の形がおかしいときは null。
 *
 * @param value - レコードの `avatar` などの値
 * @returns CID の文字列。無いときは null
 * @internal
 */
export function blobRefCid(value: unknown): string | null {
	if (value == null || typeof value !== "object") return null;
	const ref = (value as { ref?: unknown }).ref;
	return ref == null ? null : String(ref);
}

// #endregion

// #region 変換処理

/**
 * ドライブのファイルの中身を読む。
 *
 * @remarks
 * サーバーの中に置いてあるファイルは直接読み、オブジェクトストレージのファイルはダウンロードして読む。
 *
 * @param file - 対象のファイル
 * @returns ファイルの中身
 * @throws 読めなかったとき
 * @internal
 */
async function readDriveFile(file: DriveFile): Promise<Buffer> {
	if (file.storedInternal && file.accessKey) {
		return await fs.readFile(InternalStorage.resolvePath(file.accessKey));
	}

	const [path, cleanup] = await createTemp();
	try {
		await downloadUrl(file.url, path);
		return await fs.readFile(path);
	} finally {
		cleanup();
	}
}

/**
 * 画像を、Bluesky の決まりに合う JPEG にする。
 *
 * @remarks
 * 画質を少しずつ下げ、それでも 1MB を超えるときは、縦横を 3/4 にして最初からやり直す。
 *
 * @param source - 元の画像
 * @param purpose - 使い道（縮める大きさが変わる）
 * @returns 1MB 以下の JPEG
 * @throws 画像として読めなかったとき、どこまで縮めても収まらなかったとき
 * @internal
 */
async function convertForBluesky(
	source: Buffer,
	purpose: AtprotoBlobPurpose,
): Promise<Buffer> {
	let { width, height } = MAX_DIMENSIONS[purpose];

	// 3/4 ずつ縮めて 5 回までやれば、元の 1/4 程度。それでも収まらない画像は普通は無い
	for (let attempt = 0; attempt < 5; attempt++) {
		for (const quality of JPEG_QUALITIES) {
			const data = await sharp(source)
				.rotate()
				.resize(width, height, { fit: "inside", withoutEnlargement: true })
				.flatten({ background: "#ffffff" })
				.jpeg({ quality, mozjpeg: true })
				.toBuffer();
			if (data.length <= MAX_BLOB_SIZE) return data;
		}
		width = Math.floor((width * 3) / 4);
		height = Math.floor((height * 3) / 4);
	}
	throw new Error("could not shrink the image under the Bluesky size limit");
}

/**
 * 保存した blob から、レコードに入れる参照を作る。
 *
 * @param blob - CID・MIME タイプ・大きさ
 * @returns `{ $type: "blob", ref, mimeType, size }`
 * @internal
 */
function toBlobRef(blob: { cid: string; mimeType: string; size: number }): LexMap {
	return {
		$type: "blob",
		ref: parseCid(blob.cid),
		mimeType: blob.mimeType,
		size: blob.size,
	};
}

// #endregion
