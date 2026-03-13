/**
 * @packageDocumentation
 *
 * 画像処理（リサイズ・WebP 変換等）を行うサービス。
 *
 * @remarks
 * - **役割**: ドライブ追加時やサムネイル生成時に画像をリサイズ・WebP 変換する。
 *
 * @see {@link services/drive/add-file} ドライブ追加
 * @internal
 */

import sharp from "sharp";

export type IImage = {
	data: Buffer;
	ext: string | null;
	type: string;
};

export const webpDefault: sharp.WebpOptions = {
	quality: 85,
	alphaQuality: 95,
	lossless: false,
	nearLossless: false,
	smartSubsample: true,
	mixed: true,
	effort: 2,
};

/**
 * Convert to WebP
 *   with resize, remove metadata, resolve orientation, stop animation
 */
export async function convertToWebp(
	path: string,
	width: number,
	height: number,
	options: sharp.WebpOptions | number = {},
	quality?: number | null,
): Promise<IImage> {
	if (typeof options === "number") {
		quality = options;
		options = { ...webpDefault, quality };
	} else if (quality !== null && quality !== undefined) {
		options = { ...webpDefault, quality };
	} else {
		options = { ...webpDefault, ...options };
	}
	return convertSharpToWebp(await sharp(path), width, height, options);
}

export async function convertSharpToWebp(
	sharp: sharp.Sharp,
	width: number,
	height: number,
	options: sharp.WebpOptions | number = {},
	quality?: number | null,
): Promise<IImage> {
	if (typeof options === "number") {
		quality = options;
		options = { ...webpDefault, quality };
	} else if (quality !== null && quality !== undefined) {
		options = { ...webpDefault, quality };
	} else {
		options = { ...webpDefault, ...options };
	}
	const data = await sharp
		.resize(width, height, {
			fit: "inside",
			withoutEnlargement: true,
		})
		.rotate()
		.webp(options)
		.toBuffer();

	return {
		data,
		ext: "webp",
		type: "image/webp",
	};
}
