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
 * 角ごとに半径を持つ角丸矩形の SVG パスを組み立てる。
 *
 * @remarks
 * CSS の `border-radius` と同じく、辺ごとに隣接する半径の和が辺長を超える場合は
 * 全体を同じ比率で縮小する。
 *
 * @param w - 幅
 * @param h - 高さ
 * @param radii - 左上・右上・右下・左下の半径
 * @returns `d` 属性に使えるパス文字列
 * @internal
 */
function roundedRectPath(
	w: number,
	h: number,
	[tl, tr, br, bl]: [number, number, number, number],
): string {
	const ratios = [
		tl + tr > 0 ? w / (tl + tr) : Number.POSITIVE_INFINITY,
		tr + br > 0 ? h / (tr + br) : Number.POSITIVE_INFINITY,
		br + bl > 0 ? w / (br + bl) : Number.POSITIVE_INFINITY,
		bl + tl > 0 ? h / (bl + tl) : Number.POSITIVE_INFINITY,
	];
	const f = Math.min(1, ...ratios);
	const [a, b, c, d] = [tl, tr, br, bl].map((r) => r * f);
	return [
		`M ${a} 0`,
		`H ${w - b}`,
		b ? `A ${b} ${b} 0 0 1 ${w} ${b}` : `L ${w} 0`,
		`V ${h - c}`,
		c ? `A ${c} ${c} 0 0 1 ${w - c} ${h}` : `L ${w} ${h}`,
		`H ${d}`,
		d ? `A ${d} ${d} 0 0 1 0 ${h - d}` : `L 0 ${h}`,
		`V ${a}`,
		a ? `A ${a} ${a} 0 0 1 ${a} 0` : "L 0 0",
		"Z",
	].join(" ");
}

/** 猫耳がアイコン上端からはみ出す割合 */
const CAT_EAR_OVERHANG = 0.2;

const BASE83 =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

/**
 * blurhash から平均色を取り出す。
 *
 * @remarks
 * クライアントの `extract-avg-color-from-blurhash.ts` と同じ計算。blurhash の先頭 2 文字は
 * 成分数で、続く 4 文字（DC 成分）が平均色を base83 で詰めた 24bit の sRGB 値になっている。
 * 猫耳の輪郭色はクライアントでこの色を `currentColor` として使っているため、
 * OGP 側でも同じ色を再現する。
 *
 * @param hash - blurhash 文字列
 * @returns `#rrggbb` 形式の色。取り出せなければ `null`
 */
export function avgColorFromBlurhash(
	hash: string | null | undefined,
): string | null {
	if (typeof hash !== "string" || hash.length < 6) return null;
	let value = 0;
	for (const ch of hash.slice(2, 6)) {
		const i = BASE83.indexOf(ch);
		if (i < 0) return null;
		value = value * 83 + i;
	}
	// DC 成分は 24bit に収まる想定だが、壊れた入力で色として不正にならないよう丸める
	return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

/**
 * 猫耳付きのアイコンを 1 枚の PNG データ URI として組み立てる。
 *
 * @remarks
 * 形状はクライアントの `MkAvatar.vue` に合わせている。1 辺がアイコンの 50% の正方形に
 * `border-radius: 0 75% 75%`（右耳は `75% 0 75% 75%`）を当て、`rotate(±37.5deg) skew(±30deg)`
 * したもの。CSS の `transform-origin` は要素中心なので、SVG では中心へ移動してから変形する。
 *
 * 角丸は satori 側の `borderRadius` ではなくこの画像へ焼き込む。satori に丸めさせると
 * 上へはみ出した耳ごと切り取られてしまうため。
 *
 * @param raw - アイコンのバイト列（`null` なら代替画像を使う）
 * @param size - アイコン本体の一辺(px)
 * @param cornerRadius - アイコン本体の角丸半径(px)
 * @param strokeColor - 耳の輪郭色（クライアントの `currentColor` 相当）
 * @returns データ URI と、耳を含めた実寸
 */
export async function buildCatAvatarDataUri(
	raw: Buffer | null,
	size: number,
	cornerRadius: number,
	strokeColor: string,
): Promise<{ uri: string; width: number; height: number }> {
	const squareUri = await toSquareDataUri(raw, size);
	const square = Buffer.from(squareUri.split(",")[1], "base64");

	const top = Math.round(size * CAT_EAR_OVERHANG);
	const height = size + top;
	const ear = size * 0.5;
	// クライアントの枠線は border: solid 0.25rem = 4px 固定で、プロフィールページのアイコン
	// (7.5rem = 120px) に対して 3.33% にあたる。ただしカードはアイコンが大きく、同じ比率だと
	// 縮小して見たときに細く見えるため、その 2 倍を採用している（見た目重視の意図的な逸脱）。
	const border = Math.max(2, Math.round(size * (8 / 120)));

	// CSS は box-sizing: border-box なので枠線は要素の内側に収まる。
	// SVG の stroke はパス中央に乗るため、線幅の半分だけ内側へ縮めて外形を一致させる。
	const inner = ear - border;
	// border-radius は border-box 基準。`0 75% 75%` は CSS の縮小規則で 3 隅とも 0.5*ear に
	// なるので、stroke 中心線の半径はそこから線幅の半分を引いた値になる。
	const r = ear * 0.5 - border / 2;
	const inset = -ear / 2 + border / 2;

	const shape = (path: string, cx: number, angle: number) => {
		const skew = angle > 0 ? 30 : -30;
		const move = `translate(${cx} ${top + ear / 2})`;
		const spin = `rotate(${angle}) skewX(${skew})`;
		const origin = `translate(${inset} ${inset})`;
		const paint = `fill="#ebbcba" stroke="${strokeColor}" stroke-width="${border}"`;
		return `<g transform="${move} ${spin} ${origin}"><path d="${path}" ${paint}/></g>`;
	};

	const leftEar = shape(
		roundedRectPath(inner, inner, [0, r, r, r]),
		ear / 2,
		37.5,
	);
	const rightEar = shape(
		roundedRectPath(inner, inner, [r, 0, r, r]),
		size - ear / 2,
		-37.5,
	);
	const earsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}">${leftEar}${rightEar}</svg>`;

	const maskRect = `<rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#fff"/>`;
	const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${maskRect}</svg>`;

	const masked = await sharp(square)
		.composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
		.png()
		.toBuffer();

	const composed = await sharp({
		create: {
			width: size,
			height,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([
			{ input: await sharp(Buffer.from(earsSvg)).png().toBuffer(), top: 0, left: 0 },
			{ input: masked, top, left: 0 },
		])
		.png()
		.toBuffer();

	return {
		uri: `data:image/png;base64,${composed.toString("base64")}`,
		width: size,
		height,
	};
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
