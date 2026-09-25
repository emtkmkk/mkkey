/**
 * @packageDocumentation
 *
 * 絵文字の申請画像を調べる純粋な関数（画面やブラウザの API に触れない）。
 *
 * @remarks
 * 申請画面と審査画面の「サイズの警告」「左右の余白の警告」と、余白カット・縮小の計算に使う（I1〜I5、B6）。
 * - 合計ピクセルの目安は 160,000（縦×横）。超えたら警告するが、申請は止めない
 * - 左右の透明な余白の合計が 4px 以上なら警告する（上下は意図的なことが多いので見ない）
 * - 透明とみなすのはアルファ値が 0 の画素だけ（縁のぼかしは残す）
 * - アニメーション画像（GIF・APNG・アニメーション WebP）は Canvas で加工すると 1 コマ目だけになるので、加工の対象にしない
 * 画像の読み込みと Canvas での加工は {@link "@/scripts/emoji-image-tools"} にある。
 *
 * @internal
 */

/** 合計ピクセル（縦×横）の推奨の上限 */
export const EMOJI_RECOMMENDED_MAX_PIXELS = 160_000;

/** 左右の透明な余白が、合わせてこの幅以上なら警告する */
export const EMOJI_MARGIN_WARNING_PX = 4;

/**
 * 同じ縦横比のまま、合計ピクセルが推奨の上限に収まる目安のサイズを返す。
 *
 * @remarks
 * 高さ = floor(√(160000 ÷ 縦横比))、幅 = floor(高さ × 縦横比)。例：2560×256 → 1260×126、正方形 → 400×400。
 *
 * @param width - 今の幅
 * @param height - 今の高さ
 * @returns 目安の幅と高さ
 * @internal
 */
export function getRecommendedSize(width: number, height: number): { width: number; height: number } {
	const ratio = width / height;
	const h = Math.floor(Math.sqrt(EMOJI_RECOMMENDED_MAX_PIXELS / ratio));
	return { width: Math.floor(h * ratio), height: h };
}

/**
 * 合計ピクセルが推奨の上限を超えているかを返す。
 *
 * @param width - 幅
 * @param height - 高さ
 * @returns 超えていれば true
 * @internal
 */
export function isOverRecommendedPixels(width: number, height: number): boolean {
	return width * height > EMOJI_RECOMMENDED_MAX_PIXELS;
}

/**
 * 画像の左右にある、完全に透明な列の数を数える。
 *
 * @remarks
 * 画素の並びは Canvas の ImageData と同じ（RGBA の 4 バイトずつ、左上から横へ）。
 * 全部が透明な画像は、左右の余白 0 として扱う（削ると何も残らないため）。
 *
 * @param rgba - 画素のデータ
 * @param width - 幅
 * @param height - 高さ
 * @returns 左の透明な列数と右の透明な列数
 * @internal
 */
export function measureHorizontalMargins(
	rgba: ArrayLike<number>,
	width: number,
	height: number,
): { left: number; right: number } {
	const isColumnTransparent = (x: number): boolean => {
		for (let y = 0; y < height; y++) {
			if (rgba[(y * width + x) * 4 + 3] !== 0) return false;
		}
		return true;
	};
	let left = 0;
	while (left < width && isColumnTransparent(left)) left++;
	if (left === width) return { left: 0, right: 0 };
	let right = 0;
	while (right < width - left && isColumnTransparent(width - 1 - right)) right++;
	return { left, right };
}

/**
 * 左右の余白の警告を出すべきかを返す。
 *
 * @param margins - {@link measureHorizontalMargins} の結果
 * @returns 合計が {@link EMOJI_MARGIN_WARNING_PX} 以上なら true
 * @internal
 */
export function shouldWarnHorizontalMargins(margins: { left: number; right: number }): boolean {
	return margins.left + margins.right >= EMOJI_MARGIN_WARNING_PX;
}

// #region アニメーションの判定

/**
 * バイト列の中に ASCII の文字列があるかを探す。
 *
 * @param bytes - 探す対象
 * @param text - 探す文字列（ASCII）
 * @param from - 探し始める位置
 * @param to - ここまで探す（含まない）
 * @returns 見つかれば true
 */
function hasAscii(bytes: Uint8Array, text: string, from = 0, to = bytes.length): boolean {
	const end = Math.min(to, bytes.length) - text.length;
	outer: for (let i = from; i <= end; i++) {
		for (let j = 0; j < text.length; j++) {
			if (bytes[i + j] !== text.charCodeAt(j)) continue outer;
		}
		return true;
	}
	return false;
}

/**
 * GIF のコマ数を数える（2 コマ以上ならアニメーション）。
 *
 * @remarks
 * ブロックを順にたどり、画像記述子（0x2C）の数を数える。壊れたファイルでは途中までの数を返す。
 *
 * @param b - ファイルのバイト列
 * @returns コマ数
 */
function countGifFrames(b: Uint8Array): number {
	if (b.length < 13) return 0;
	let pos = 13;
	// 全体のカラーテーブルがあれば飛ばす
	if (b[10] & 0x80) pos += 3 * (1 << ((b[10] & 0x07) + 1));
	let frames = 0;
	const skipSubBlocks = () => {
		while (pos < b.length && b[pos] !== 0) pos += b[pos] + 1;
		pos++;
	};
	while (pos < b.length) {
		const block = b[pos];
		if (block === 0x3b) break; // 終わり
		if (block === 0x21) {
			// 拡張ブロック
			pos += 2;
			skipSubBlocks();
		} else if (block === 0x2c) {
			frames++;
			if (frames >= 2) return frames;
			const packed = b[pos + 9];
			pos += 10;
			if (packed & 0x80) pos += 3 * (1 << ((packed & 0x07) + 1));
			pos++; // LZW の最小コードサイズ
			skipSubBlocks();
		} else {
			break;
		}
	}
	return frames;
}

/**
 * 画像ファイルがアニメーションかを判定する。
 *
 * @remarks
 * - GIF：画像のコマが 2 つ以上
 * - PNG：APNG の制御チャンク（acTL）がある
 * - WebP：拡張形式（VP8X）の ANIM チャンクがある
 * それ以外の形式は、アニメーションではないとみなす。
 *
 * @param buffer - ファイルの中身
 * @returns アニメーションなら true
 * @internal
 */
export function isAnimatedImage(buffer: ArrayBuffer): boolean {
	const b = new Uint8Array(buffer);
	if (hasAscii(b, "GIF8", 0, 4)) return countGifFrames(b) >= 2;
	if (b[0] === 0x89 && hasAscii(b, "PNG", 1, 4)) {
		// acTL は最初の画像データ（IDAT）より前にある
		const idat = (() => {
			for (let i = 8; i + 4 <= b.length; i++) {
				if (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x41 && b[i + 3] === 0x54) return i;
			}
			return b.length;
		})();
		return hasAscii(b, "acTL", 8, idat);
	}
	if (hasAscii(b, "RIFF", 0, 4) && hasAscii(b, "WEBP", 8, 12)) {
		return hasAscii(b, "VP8X", 12, 16) && hasAscii(b, "ANIM", 12, Math.min(b.length, 4096));
	}
	return false;
}

// #endregion
