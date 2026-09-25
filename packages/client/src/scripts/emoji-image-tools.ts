/**
 * @packageDocumentation
 *
 * 絵文字の申請画像を、ブラウザ（Canvas）で調べたり加工したりする。
 *
 * @remarks
 * 申請画面と審査画面で共通に使う（I1〜I5）。
 * - {@link analyzeEmojiImage}：幅・高さ、アニメーションか、左右の透明な余白、合計ピクセルの警告をまとめて調べる
 * - {@link cropEmojiHorizontalMargins}：左右の透明な余白を削る（上下は削らない）
 * - {@link shrinkEmojiToRecommended}：同じ縦横比で、合計ピクセルが 160,000 に収まる目安のサイズへ縮める（拡大はしない）
 * 加工はボタンを押したときだけ行い、結果は新しいファイル（PNG）として返す。元の画像はそのまま。
 * アニメーション画像は加工すると 1 コマ目だけになるので、呼び出し側で加工のボタンを出さないこと。
 * 判定や計算の中身は {@link "@/scripts/emoji-image-analysis"} の純粋な関数にある。
 *
 * @internal
 */
import {
	getRecommendedSize,
	isAnimatedImage,
	isOverRecommendedPixels,
	measureHorizontalMargins,
	shouldWarnHorizontalMargins,
} from "@/scripts/emoji-image-analysis";

/** {@link analyzeEmojiImage} の結果 */
export type EmojiImageAnalysis = {
	width: number;
	height: number;
	/** アニメーション画像か（true なら加工の対象にしない） */
	animated: boolean;
	/** 左右の完全に透明な列の数 */
	margins: { left: number; right: number };
	/** 左右の余白の警告を出すか（合計 4px 以上。アニメーションでは出さない） */
	marginWarning: boolean;
	/** 合計ピクセルが推奨の上限（160,000）を超えているか */
	sizeWarning: boolean;
	/** 同じ縦横比での目安のサイズ */
	recommended: { width: number; height: number };
};

/**
 * 画像を読み込む。
 *
 * @param blob - 画像
 * @returns 読み込んだ画像（使い終わったら close する）
 */
async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
	return await createImageBitmap(blob);
}

/**
 * Canvas を PNG にする。
 *
 * @param canvas - 描いた Canvas
 * @returns PNG の Blob
 * @throws Error 変換に失敗したとき
 */
function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
	});
}

/**
 * 画像を調べる。
 *
 * @param blob - 画像（申請者が選んだファイルや、ドライブから取った画像）
 * @returns 調べた結果
 * @internal
 */
export async function analyzeEmojiImage(blob: Blob): Promise<EmojiImageAnalysis> {
	const animated = isAnimatedImage(await blob.arrayBuffer());
	const bitmap = await loadBitmap(blob);
	try {
		const { width, height } = bitmap;
		let margins = { left: 0, right: 0 };
		if (!animated) {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d", { willReadFrequently: true });
			if (ctx) {
				ctx.drawImage(bitmap, 0, 0);
				margins = measureHorizontalMargins(ctx.getImageData(0, 0, width, height).data, width, height);
			}
		}
		return {
			width,
			height,
			animated,
			margins,
			marginWarning: !animated && shouldWarnHorizontalMargins(margins),
			sizeWarning: isOverRecommendedPixels(width, height),
			recommended: getRecommendedSize(width, height),
		};
	} finally {
		bitmap.close();
	}
}

/**
 * 左右の透明な余白を削った画像を作る。
 *
 * @param blob - 元の画像（静止画）
 * @param margins - 削る幅（{@link analyzeEmojiImage} の margins）
 * @returns 削った画像（PNG）
 * @internal
 */
export async function cropEmojiHorizontalMargins(
	blob: Blob,
	margins: { left: number; right: number },
): Promise<Blob> {
	const bitmap = await loadBitmap(blob);
	try {
		const width = bitmap.width - margins.left - margins.right;
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas 2d context is not available");
		ctx.drawImage(bitmap, margins.left, 0, width, bitmap.height, 0, 0, width, bitmap.height);
		return await canvasToPng(canvas);
	} finally {
		bitmap.close();
	}
}

/**
 * 同じ縦横比のまま、目安のサイズへ縮めた画像を作る。既に目安以下なら元の画像をそのまま返す（拡大はしない）。
 *
 * @param blob - 元の画像（静止画）
 * @returns 縮めた画像（PNG）、または元の画像
 * @internal
 */
export async function shrinkEmojiToRecommended(blob: Blob): Promise<Blob> {
	const bitmap = await loadBitmap(blob);
	try {
		if (!isOverRecommendedPixels(bitmap.width, bitmap.height)) return blob;
		const size = getRecommendedSize(bitmap.width, bitmap.height);
		const canvas = document.createElement("canvas");
		canvas.width = size.width;
		canvas.height = size.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas 2d context is not available");
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(bitmap, 0, 0, size.width, size.height);
		return await canvasToPng(canvas);
	} finally {
		bitmap.close();
	}
}
