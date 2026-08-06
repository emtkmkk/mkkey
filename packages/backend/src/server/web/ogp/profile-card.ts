/**
 * @packageDocumentation
 *
 * プロフィール OGP カード（デザイン仕様 14a）の組み立てとレンダリング。
 *
 * @remarks
 * - **キャンバス**: 1200x630、背景 `#fbf9f4`、上端 8px にインスタンスカラーの帯。
 * - **表示名**: `:shortcode:` をカスタム絵文字画像へ展開し、Unicode 絵文字は Twemoji に置き換える。
 *   幅を実測して 1 行に収め、溢れたら末尾に `…` を出す（{@link metrics} 参照）。
 * - **統計**: `notesPostDays` が 0 のときは投稿数のみを出す。投稿年数は切り上げなので
 *   1 日でも投稿していれば 0.01 年以上になり、「年数だけ 0」という状態は発生しない。
 * - **アイコン形状**: 通常は角丸四角。`isCat` のときは円形にして猫耳を付ける
 *   （クライアントの `MkAvatar.vue` が isCat で角丸を強制解除しているのに合わせる）。
 * - bio・カスタムフィールドは MFM を含むため使わない。
 *
 * @internal
 */

import satori from "satori";
import sharp from "sharp";
import { IsNull } from "typeorm";
import { parse as parseTwemoji } from "@twemoji/parser";
import config from "@/config/index.js";
import { Emojis } from "@/models/index.js";
import { getEffectiveUsageVisibility } from "@/models/repositories/emoji.js";
import Logger from "@/services/logger.js";
import {
	getFonts,
	getTwemojiDataUri,
	fetchImage,
	toSquareDataUri,
	buildCatAvatarDataUri,
	avgColorFromBlurhash,
	loadCustomEmoji,
	type OgpFonts,
} from "./assets.js";
import type { FontMetrics } from "./metrics.js";

const logger = new Logger("ogp");

//#region デザイン仕様 14a の定数
const CANVAS_W = 1200;
const CANVAS_H = 630;
const BG = "#fbf9f4";
const INK = "#211f24";
const RULE_COLOR = "rgba(33,31,36,.24)";
const SUB_COLOR = "rgba(33,31,36,.5)";
const ACCT_COLOR = "rgba(33,31,36,.62)";
const FOOT_COLOR = "rgba(33,31,36,.4)";
const NAME_SIZE = 52;
const ACCT_SIZE = 27;
/** カード上でのアイコンの一辺 */
const AVATAR_SIZE = 172;
/** アイコン画像を作るときの解像度（表示サイズの 2 倍で描いて縮小する） */
const AVATAR_SRC = 344;
/** 通常アイコンの角丸半径。にゃんこは円形になるので使わない */
const AVATAR_CORNER_RADIUS = 28;
/** 表示名・ユーザー名の 1 行に使える幅 */
const NAME_BUDGET = 900;
/** 統計行の区切り線の幅。項目数が減っても骨格を保つため固定する */
const STATS_RULE_WIDTH = 512;
const DEFAULT_THEME_COLOR = "#f8bcba";
//#endregion

/** カード描画に必要な入力 */
export type ProfileCardParams = {
	user: {
		name: string | null;
		username: string;
		host: string | null;
		isCat: boolean;
		notesCount: number;
		notesPostDays: number;
	};
	avatarUrl: string;
	/** アイコンの blurhash。猫耳の輪郭色をクライアントと合わせるために使う */
	avatarBlurhash: string | null;
	instance: {
		name: string;
		iconUrl: string | null;
		themeColor: string | null;
	};
	/** 「◯◯現在」として焼き込む時刻 */
	now: Date;
};

type Node = string | { type: string; props: Record<string, unknown> };

const box = (style: Record<string, unknown>, children: Node[]): Node => ({
	type: "div",
	props: { style: { display: "flex", ...style }, children },
});
const text = (style: Record<string, unknown>, value: string): Node => ({
	type: "div",
	props: { style: { display: "flex", ...style }, children: value },
});
const image = (src: string, style: Record<string, unknown>): Node => ({
	type: "img",
	props: { src, style: { objectFit: "cover", ...style } },
});

//#region 表示名のトークン化と切り詰め
type Token =
	| { t: "text"; s: string; w?: number }
	| { t: "img"; uri: string; w: number; h: number; srcW: number; ratio: number };

/**
 * 絵文字の前後の空白が消えないようにする。
 *
 * @remarks
 * satori は flex の子になった文字列の前後の空白を詰めるため、素のままだと
 * `たこ :kawaii: すき` が `たこ[絵文字]すき` と詰まって描画される。連続する空白も
 * 通常の空白処理で 1 個に潰れる。表示名は 1 行固定で折り返さないので、
 * 半角スペースをノーブレークスペースへ置き換えて元の見た目を保つ。
 * LINE Seed JP では U+00A0 の送り幅は U+0020 と同じなので、幅の実測値はずれない。
 *
 * @param s - 元の文字列
 * @returns 半角スペースを U+00A0 に置き換えた文字列
 * @internal
 */
const preserveSpaces = (s: string): string =>
	s.replace(/\u0020/g, "\u00a0");

/**
 * 表示名を「テキスト」「カスタム絵文字」「Unicode 絵文字」のトークン列へ分解する。
 *
 * @param name - 表示名
 * @param size - 描画フォントサイズ(px)
 * @param emojiHost - カスタム絵文字を探すホスト（ローカルは `null`）
 * @returns 左から順に並んだトークン列
 * @internal
 */
async function tokenize(
	name: string,
	size: number,
	emojiHost: string | null,
): Promise<Token[]> {
	type Mark =
		| { s: number; e: number; kind: "custom"; shortcode: string }
		| { s: number; e: number; kind: "uni"; text: string };
	const marks: Mark[] = [];

	for (const m of name.matchAll(/:([a-zA-Z0-9_+-]+):/g)) {
		marks.push({
			s: m.index!,
			e: m.index! + m[0].length,
			kind: "custom",
			shortcode: m[1],
		});
	}
	for (const e of parseTwemoji(name)) {
		// カスタム絵文字の記法と重なるものは除く
		if (marks.some((k) => e.indices[0] < k.e && k.s < e.indices[1])) continue;
		marks.push({ s: e.indices[0], e: e.indices[1], kind: "uni", text: e.text });
	}
	marks.sort((a, b) => a.s - b.s);

	const out: Token[] = [];
	let cur = 0;
	for (const k of marks) {
		if (k.s > cur) {
			out.push({ t: "text", s: preserveSpaces(name.slice(cur, k.s)) });
		}

		if (k.kind === "custom") {
			const img = await resolveCustomEmoji(k.shortcode, emojiHost, size);
			// 解決できなければショートコードのまま残す
			out.push(img ?? { t: "text", s: preserveSpaces(name.slice(k.s, k.e)) });
		} else {
			const uri = await getTwemojiDataUri(k.text);
			if (uri) {
				out.push({
					t: "img",
					uri,
					w: size,
					h: size,
					srcW: 128,
					ratio: 1,
				});
			} else {
				// Twemoji に無い絵文字はフォント側に任せる（多くは豆腐になる）
				out.push({ t: "text", s: k.text, w: size });
			}
		}
		cur = k.e;
	}
	if (cur < name.length) {
		out.push({ t: "text", s: preserveSpaces(name.slice(cur)) });
	}
	return out;
}

/**
 * ショートコードからカスタム絵文字の画像トークンを作る。
 *
 * @remarks
 * `usageVisibility` が private のものは `/emoji/:path` と同様に扱わない（ショートコードのまま残る）。
 *
 * @internal
 */
async function resolveCustomEmoji(
	shortcode: string,
	host: string | null,
	size: number,
): Promise<Token | null> {
	try {
		const emoji = await Emojis.findOneBy({
			name: shortcode,
			host: host ?? IsNull(),
		});
		if (!emoji) return null;
		if (getEffectiveUsageVisibility(emoji) === "private") return null;

		const url = emoji.publicUrl || emoji.originalUrl;
		if (!url) return null;

		const loaded = await loadCustomEmoji(url, 128);
		if (!loaded) return null;

		return {
			t: "img",
			uri: `data:image/png;base64,${loaded.buf.toString("base64")}`,
			w: size * loaded.ratio,
			h: size,
			srcW: loaded.width,
			ratio: loaded.ratio,
		};
	} catch (err) {
		logger.warn(`カスタム絵文字の解決に失敗: ${shortcode} (${err})`);
		return null;
	}
}

const tokenWidth = (k: Token, m: FontMetrics, size: number): number =>
	k.t === "img" ? k.w : (k.w ?? m.width(k.s, size));

/**
 * トークン列を `budget` 幅へ収める。溢れる場合は末尾を切り、`truncated` を立てる。
 *
 * @remarks
 * 画像の途中で切れる場合は画像を「左側だけ」に切り詰める。横長のカスタム絵文字は
 * 左から右へ読ませるものが多く、左端を残すのが最も情報が残るため。
 *
 * @internal
 */
function fitToBudget(
	tokens: Token[],
	m: FontMetrics,
	size: number,
	budget: number,
): { tokens: Token[]; truncated: boolean } {
	const total = tokens.reduce((a, k) => a + tokenWidth(k, m, size), 0);
	if (total <= budget) return { tokens, truncated: false };

	const limit = budget - m.width("…", size);
	const out: Token[] = [];
	let used = 0;

	for (const k of tokens) {
		const w = tokenWidth(k, m, size);
		if (used + w <= limit) {
			out.push(k);
			used += w;
			continue;
		}
		const room = limit - used;
		if (k.t === "text" && k.w === undefined) {
			let acc = "";
			for (const ch of k.s) {
				const cw = m.width(ch, size);
				if (used + cw > limit) break;
				acc += ch;
				used += cw;
			}
			if (acc) out.push({ t: "text", s: acc });
		} else if (k.t === "img" && room > size * 0.35) {
			out.push({ ...k, w: Math.floor(room) });
		}
		break;
	}
	return { tokens: out, truncated: true };
}

/**
 * トークン列を satori のノード配列へ変換する。幅が縮められた画像は左側を切り出す。
 *
 * @internal
 */
async function toNodes(tokens: Token[], size: number): Promise<Node[]> {
	const nodes: Node[] = [];
	for (const k of tokens) {
		if (k.t === "text") {
			nodes.push(k.s);
			continue;
		}
		const natural = size * k.ratio;
		let uri = k.uri;
		if (k.w < natural - 0.5) {
			// 表示したい割合だけ元画像から切り出す
			const px = Math.max(1, Math.round((k.w / natural) * k.srcW));
			try {
				const src = Buffer.from(uri.split(",")[1], "base64");
				const meta = await sharp(src).metadata();
				const cropped = await sharp(src)
					.extract({
						left: 0,
						top: 0,
						width: Math.min(px, meta.width ?? px),
						height: meta.height ?? 128,
					})
					.png()
					.toBuffer();
				uri = `data:image/png;base64,${cropped.toString("base64")}`;
			} catch (err) {
				logger.warn(`絵文字の切り出しに失敗 (${err})`);
			}
		}
		nodes.push({
			type: "img",
			props: {
				src: uri,
				style: {
					width: Math.round(k.w),
					height: Math.round(k.h),
					objectFit: "fill",
					flex: "none",
				},
			},
		});
	}
	return nodes;
}
//#endregion

//#region 統計と日時
/**
 * 統計 3 項目を組み立てる。`notesPostDays` が 0 なら投稿数のみを返す。
 *
 * @param notesCount - 投稿数
 * @param notesPostDays - 投稿日数（単調増加値）
 * @returns `[値, ラベル]` の配列
 * @internal
 */
export function buildStats(
	notesCount: number,
	notesPostDays: number,
): [string, string][] {
	const posts: [string, string] = [
		notesCount.toLocaleString("ja-JP"),
		"投稿数",
	];
	if (notesPostDays <= 0) return [posts];

	// 切り上げ: 1 日でも投稿していれば 0.01 年として出す
	const years = Math.ceil((notesPostDays / 365) * 100) / 100;
	const average = notesCount / notesPostDays;
	return [
		posts,
		[years.toFixed(2), "投稿年数"],
		[average.toFixed(1), "平均投稿数（日あたり）"],
	];
}

const JST_FORMAT = new Intl.DateTimeFormat("ja-JP", {
	timeZone: "Asia/Tokyo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

/**
 * 「yyyy年MM月dd日 hh時mm分 現在」を JST 固定で組み立てる。
 *
 * @remarks
 * サーバの `TZ` 環境変数に左右されないよう、タイムゾーンを明示している。
 *
 * @param date - 対象日時
 * @returns 表示用の文字列
 * @internal
 */
export function formatJst(date: Date): string {
	const p = Object.fromEntries(
		JST_FORMAT.formatToParts(date).map((x) => [x.type, x.value]),
	);
	return `${p.year}年${p.month}月${p.day}日 ${p.hour}時${p.minute}分 現在`;
}
//#endregion

/**
 * プロフィール OGP カードを PNG として描画する。
 *
 * @param params - 描画に使うユーザー・インスタンス情報
 * @returns PNG のバイト列
 */
export async function renderProfileCard(
	params: ProfileCardParams,
): Promise<Buffer> {
	const { user, instance, now } = params;
	const f: OgpFonts = await getFonts();

	const displayName = user.name?.trim() || user.username;
	const acct = `@${user.username}${user.host ? `@${user.host}` : `@${config.host}`}`;
	const profileUrl = `${config.url}/@${user.username}`;

	const [avatarRaw, iconRaw] = await Promise.all([
		fetchImage(params.avatarUrl),
		instance.iconUrl ? fetchImage(instance.iconUrl) : Promise.resolve(null),
	]);
	const iconUri = await toSquareDataUri(iconRaw, 160);

	// にゃんこは円形＋猫耳。クライアント（MkAvatar.vue）が isCat のとき角丸を強制的に
	// 解除しているのに合わせる。耳は角丸の外へはみ出すので画像へ焼き込む。
	// 耳の輪郭色はクライアントと同じくアイコンの平均色。取れなければ文字色へフォールバック
	// （クライアントも color 未設定時は継承した文字色になる）
	const earColor = avgColorFromBlurhash(params.avatarBlurhash) ?? INK;
	const avatar = user.isCat
		? await buildCatAvatarDataUri(
				avatarRaw,
				AVATAR_SRC,
				AVATAR_SRC / 2,
				earColor,
		  )
		: {
				uri: await toSquareDataUri(avatarRaw, AVATAR_SRC),
				width: AVATAR_SRC,
				height: AVATAR_SRC,
		  };
	const avatarHeight = Math.round(
		(AVATAR_SIZE * avatar.height) / avatar.width,
	);

	const nameFit = fitToBudget(
		await tokenize(displayName, NAME_SIZE, user.host),
		f.bold,
		NAME_SIZE,
		NAME_BUDGET,
	);
	const nameNodes = await toNodes(nameFit.tokens, NAME_SIZE);
	if (nameFit.truncated) nameNodes.push("…");

	const acctFit = fitToBudget(
		[{ t: "text", s: acct }],
		f.regular,
		ACCT_SIZE,
		NAME_BUDGET,
	);
	const acctNodes = await toNodes(acctFit.tokens, ACCT_SIZE);
	if (acctFit.truncated) acctNodes.push("…");

	const stats = buildStats(user.notesCount, user.notesPostDays);
	const themeColor = instance.themeColor || DEFAULT_THEME_COLOR;

	const tree = box(
		{
			width: "100%",
			height: "100%",
			background: BG,
			position: "relative",
			flexDirection: "column",
			alignItems: "flex-start",
			justifyContent: "center",
			gap: 44,
			padding: "40px 0 0 40px",
			borderTop: `8px solid ${themeColor}`,
		},
		[
			// インスタンスヘッダー（左上）
			box({ position: "absolute", top: 32, left: 40, alignItems: "center", gap: 20 }, [
				image(iconUri, { width: 80, height: 80, borderRadius: 16, flex: "none" }),
				box({ flexDirection: "column", gap: 3 }, [
					text({ fontSize: 29, fontWeight: 700, color: INK }, instance.name),
					text({ fontSize: 22, fontWeight: 500, color: SUB_COLOR }, config.host),
				]),
			]),
			// プロフィール本体
			box({ alignItems: "center", gap: 32 }, [
				image(avatar.uri, {
					width: AVATAR_SIZE,
					height: avatarHeight,
					// 猫耳付きは画像側で円形まで済ませてあるので satori では丸めない
					...(user.isCat
						? { objectFit: "fill" }
						: { borderRadius: AVATAR_CORNER_RADIUS }),
					flex: "none",
				}),
				box({ flexDirection: "column", gap: 4, maxWidth: NAME_BUDGET, minWidth: 0 }, [
					box(
						{
							fontSize: NAME_SIZE,
							lineHeight: 1.28,
							fontWeight: 700,
							color: INK,
							alignItems: "center",
							whiteSpace: "nowrap",
							overflow: "hidden",
						},
						nameNodes,
					),
					box(
						{
							fontSize: ACCT_SIZE,
							fontWeight: 500,
							color: ACCT_COLOR,
							alignItems: "center",
							whiteSpace: "nowrap",
							overflow: "hidden",
						},
						acctNodes,
					),
				]),
			]),
			// 統計行
			box(
				{
					gap: 60,
					borderTop: `1px solid ${RULE_COLOR}`,
					paddingTop: 24,
					width: STATS_RULE_WIDTH,
				},
				stats.map(([value, label]) =>
					box({ flexDirection: "column" }, [
						text({ fontSize: 34, fontWeight: 700, color: INK }, value),
						text({ fontSize: 16, fontWeight: 500, color: SUB_COLOR }, label),
					]),
				),
			),
			// NOTE: 仕様書 14a は左に生成時刻・右に URL だが、左右を入れ替えている
			text(
				{ position: "absolute", left: 40, bottom: 36, fontSize: 17, fontWeight: 500, color: FOOT_COLOR },
				profileUrl,
			),
			text(
				{ position: "absolute", right: 40, bottom: 36, fontSize: 17, fontWeight: 500, color: FOOT_COLOR },
				formatJst(now),
			),
		],
	);

	const svg = await satori(tree as never, {
		width: CANVAS_W,
		height: CANVAS_H,
		fonts: f.fonts,
		// フォントに無い文字は落とさず豆腐のまま描く（何か文字があること自体は伝わるため）
		loadAdditionalAsset: async (code: string, segment: string) =>
			code === "emoji" ? ((await getTwemojiDataUri(segment)) ?? []) : [],
	});

	return await sharp(Buffer.from(svg)).png().toBuffer();
}
