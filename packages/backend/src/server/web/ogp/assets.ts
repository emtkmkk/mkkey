/**
 * @packageDocumentation
 *
 * OGP 画像生成が使う素材（フォント・Twemoji・アイコン画像）の読み込みとキャッシュ。
 *
 * @remarks
 * - **フォント**: 起動時ではなく初回リクエスト時に遅延ロードする。OGP を一度も生成しない
 *   ワーカーでは 8MB 弱のフォントを常駐させないため。
 * - **Twemoji**: `@discordapp/twemoji` の SVG を **PNG へ事前ラスタライズしてから** satori に渡す。
 *   sharp(librsvg) は `<image>` にネストした SVG データ URI を無視して黙って空白にするため、
 *   SVG のまま渡すと絵文字が描画されない。
 * - **アイコン**: 内部ストレージ上のファイルはディスクから直接読み、それ以外は SSRF 対策込みの
 *   `getResponse` で取得する。取得に失敗しても例外にせず `null` を返し、呼び出し側で
 *   代替画像へフォールバックさせる（アイコンが出ないだけでカード自体は成立するため）。
 *
 * @internal
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import config from "@/config/index.js";
import { getResponse } from "@/misc/fetch.js";
import { InternalStorage } from "@/services/drive/internal-storage.js";
import Logger from "@/services/logger.js";
import { loadFontMetrics, type FontMetrics } from "./metrics.js";

const logger = new Logger("ogp");

const _dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(_dirname, "../../../../assets");
const twemojiDir = resolve(
	_dirname,
	"../../../../node_modules/@discordapp/twemoji/dist/svg",
);

/** satori に渡すフォント定義とメトリクスの組 */
export type OgpFonts = {
	fonts: {
		name: string;
		data: Buffer;
		weight: 400 | 700;
		style: "normal";
	}[];
	/** 太字（表示名・統計値）用のメトリクス */
	bold: FontMetrics;
	/** 通常字（ユーザー名など）用のメトリクス */
	regular: FontMetrics;
};

let fontsPromise: Promise<OgpFonts> | null = null;

/**
 * OGP 用フォントを遅延ロードする。二度目以降は同じインスタンスを返す。
 *
 * @returns satori 用のフォント定義とメトリクス
 * @throws フォントファイルが見つからない場合
 */
export function getFonts(): Promise<OgpFonts> {
	if (fontsPromise) return fontsPromise;
	fontsPromise = (async () => {
		const regularPath = `${assetsDir}/fonts/LINESeedJP-Regular.otf`;
		const boldPath = `${assetsDir}/fonts/LINESeedJP-Bold.otf`;
		const regularData = readFileSync(regularPath);
		const boldData = readFileSync(boldPath);
		logger.info("OGP 用フォントを読み込みました (LINE Seed JP Regular / Bold)");
		return {
			fonts: [
				{
					name: "LINE Seed JP",
					data: regularData,
					weight: 400 as const,
					style: "normal" as const,
				},
				{
					name: "LINE Seed JP",
					data: boldData,
					weight: 700 as const,
					style: "normal" as const,
				},
			],
			regular: loadFontMetrics(regularData),
			bold: loadFontMetrics(boldData),
		};
	})().catch((err) => {
		// 次のリクエストで再試行できるようにキャッシュを捨てる
		fontsPromise = null;
		throw err;
	});
	return fontsPromise;
}

/** Twemoji のコードポイント列をファイル名へ変換する（クライアントの char2fileName と同じ規則） */
function twemojiFileName(char: string): string {
	let codes = Array.from(char).map((c) => c.codePointAt(0)?.toString(16));
	if (!codes.includes("200d")) codes = codes.filter((c) => c !== "fe0f");
	return codes.filter((c) => c?.length).join("-");
}

const twemojiCache = new Map<string, string | null>();

/**
 * Unicode 絵文字を Twemoji の PNG データ URI にする。
 *
 * @param char - 絵文字の書記素クラスタ
 * @returns データ URI。該当する Twemoji が無ければ `null`
 */
export async function getTwemojiDataUri(char: string): Promise<string | null> {
	const cached = twemojiCache.get(char);
	if (cached !== undefined) return cached;

	const file = `${twemojiDir}/${twemojiFileName(char)}.svg`;
	if (!existsSync(file)) {
		twemojiCache.set(char, null);
		return null;
	}

	try {
		// NOTE: SVG のまま渡すと sharp が描画しないため必ず PNG にする
		const png = await sharp(readFileSync(file), { density: 400 })
			.resize(128, 128, {
				fit: "contain",
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();
		const uri = `data:image/png;base64,${png.toString("base64")}`;
		twemojiCache.set(char, uri);
		return uri;
	} catch (err) {
		logger.warn(`Twemoji のラスタライズに失敗: ${char} (${err})`);
		twemojiCache.set(char, null);
		return null;
	}
}

/** 画像取得の上限。アイコン用途なので小さく抑える */
const IMAGE_FETCH_TIMEOUT = 5 * 1000;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/**
 * アイコン等の画像を取得する。
 *
 * @remarks
 * 同一オリジンかつ内部ストレージ上のファイルは自分自身への HTTP を避けてディスクから読む。
 * それ以外は `getResponse`（プライベート IP 拒否あり）で取得する。
 *
 * @param url - 取得対象の URL
 * @returns 画像のバイト列。取得できなければ `null`
 */
export async function fetchImage(url: string): Promise<Buffer | null> {
	try {
		const parsed = new URL(url);
		const selfOrigin = new URL(config.url).origin;

		if (parsed.origin === selfOrigin && parsed.pathname.startsWith("/files/")) {
			const key = decodeURIComponent(parsed.pathname.slice("/files/".length));
			// パストラバーサル除け: キーに区切り文字を含むものは受け付けない
			if (key && !key.includes("/") && !key.includes("\\")) {
				const path = InternalStorage.resolvePath(key);
				if (existsSync(path)) return readFileSync(path);
			}
			return null;
		}

		const res = await getResponse({
			url,
			method: "GET",
			headers: { "User-Agent": config.userAgent, Accept: "image/*" },
			timeout: IMAGE_FETCH_TIMEOUT,
			size: IMAGE_MAX_BYTES,
		});
		return Buffer.from(await res.arrayBuffer());
	} catch (err) {
		logger.warn(`OGP 用画像の取得に失敗: ${url} (${err})`);
		return null;
	}
}

/**
 * 画像を正方形の PNG データ URI へ整える。取得済みバイト列が無効なら代替画像を使う。
 *
 * @param raw - 元画像のバイト列（`null` 可）
 * @param size - 出力する一辺の長さ(px)
 * @returns PNG のデータ URI
 */
export async function toSquareDataUri(
	raw: Buffer | null,
	size: number,
): Promise<string> {
	const fallback = `${assetsDir}/user-unknown.png`;
	for (const src of [raw, existsSync(fallback) ? readFileSync(fallback) : null]) {
		if (!src) continue;
		try {
			const png = await sharp(src, { animated: false })
				.resize(size, size, { fit: "cover" })
				.png()
				.toBuffer();
			return `data:image/png;base64,${png.toString("base64")}`;
		} catch (err) {
			logger.warn(`OGP 用画像の変換に失敗 (${err})`);
		}
	}
	// 代替画像すら読めない場合は透明な 1x1 で埋める
	const blank = await sharp({
		create: {
			width: 1,
			height: 1,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.png()
		.toBuffer();
	return `data:image/png;base64,${blank.toString("base64")}`;
}

/**
 * カスタム絵文字を「高さ基準でリサイズした PNG」として読み込む。
 *
 * @param url - 絵文字画像の URL
 * @param height - 目標の高さ(px)
 * @returns バイト列・実寸・アスペクト比。取得できなければ `null`
 */
export async function loadCustomEmoji(
	url: string,
	height: number,
): Promise<{ buf: Buffer; width: number; height: number; ratio: number } | null> {
	const raw = await fetchImage(url);
	if (!raw) return null;
	try {
		const buf = await sharp(raw, { animated: false })
			.resize({ height })
			.png()
			.toBuffer();
		const meta = await sharp(buf).metadata();
		if (meta.width == null || meta.height == null) return null;
		return {
			buf,
			width: meta.width,
			height: meta.height,
			ratio: meta.width / meta.height,
		};
	} catch (err) {
		logger.warn(`カスタム絵文字の変換に失敗: ${url} (${err})`);
		return null;
	}
}
