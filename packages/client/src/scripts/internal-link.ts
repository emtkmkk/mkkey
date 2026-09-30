/**
 * @packageDocumentation
 *
 * もこきー自身の URL から、どの画面かを調べる（投稿に貼られた URL の「〇〇に移動」の表示に使う）。
 *
 * @remarks
 * 画面名は、ビルド時に各画面の見出しから作った表（`virtual:route-titles`）から引く。
 * - 表に無い画面（中身で名前が変わる画面、OGP を持つ画面、中身が特に無い URL）は null を返し、今までどおり Web プレビューを出す
 * - 設定・コントロールパネルの子の画面は「設定 > タイムライン」のように親の名前を付ける
 * - 設定の画面に `?setting=キー` が付いていれば、その設定項目の名前も付ける（設定検索と同じく `i18n.ts[キー]` で引く）
 * - 絵文字の情報の画面は、絵文字の名前を返す（呼び出し側で絵文字の画像と一緒に出す）
 *
 * @internal
 */
import routeTitles, { type RouteLinkTitle } from "virtual:route-titles";
import { url as local } from "@/config";
import { i18n } from "@/i18n";
import { mainRouter } from "@/router";

/** 調べた結果 */
export type InternalLinkInfo =
	| {
			kind: "page";
			/** 画面名（例「設定 > タイムライン > リアクションしたリノートを隠す」） */
			label: string;
			/** アプリ内で移動する先（`/settings/timeline?setting=…`） */
			to: string;
	  }
	| {
			kind: "emoji";
			/** 絵文字の書き方（例「:yorosiku:」「:blobcat@misskey.io:」） */
			emoji: string;
			to: string;
	  };

/** URL の形 → 表の 1 件 */
const byPath = new Map(routeTitles.map((e) => [e.path, e]));

/**
 * 画面名を文字にする（言語のキーなら見る人の言語で。`{param}` はルートのパラメータに置き換える）。
 *
 * @param t - 画面名
 * @param params - ルートのパラメータ
 * @returns 文字（引けなければ null）
 */
function titleText(t: RouteLinkTitle | null, params: Map<string, string>): string | null {
	if (t == null) return null;
	const base = t.key ? (i18n.ts as Record<string, unknown>)[t.key] : t.text;
	if (typeof base !== "string") return t.text ?? null;
	return base.replace(/\{(\w+)\}/g, (_, k: string) => params.get(k) ?? "");
}

/**
 * もこきー自身の URL を調べる。
 *
 * @param href - 投稿に貼られた URL
 * @returns 画面の情報（もこきー自身の URL でない、または今までどおり Web プレビューを出す URL なら null）
 * @internal
 */
export function resolveInternalLink(href: string): InternalLinkInfo | null {
	let u: URL;
	try {
		u = new URL(href);
	} catch {
		return null;
	}
	if (u.origin !== local) return null;
	const to = u.pathname + u.search;

	// ルーターと同じ方法で、どの画面かを調べる（入れ子の親から順にたどって、URL の形をつなぐ）
	let resolved;
	try {
		resolved = mainRouter.resolve(to);
	} catch {
		return null;
	}
	if (resolved == null) return null;
	let pattern = "";
	let params = new Map<string, string>();
	for (let r: typeof resolved | undefined = resolved; r != null; r = r.child) {
		pattern += r.route.path;
		params = new Map([...params, ...r.props]);
	}
	// 親の画面そのもの（/settings など）は子の "/" までたどって "/settings/" になるので、末尾の "/" を外す
	pattern = pattern.replace(/\/+$/, "") || "/";

	const entry = byPath.get(pattern);
	if (entry == null) return null;

	if (entry.kind === "emoji") {
		const name = params.get("emoji");
		return name ? { kind: "emoji", emoji: `:${name.replace(/^:|:$/g, "")}:`, to } : null;
	}

	const names = [...entry.parents, entry.title].map((t) => titleText(t, params)).filter((x): x is string => !!x);
	if (names.length === 0) return null;

	// 設定の画面で、特定の設定項目を指しているとき
	const settingKey = u.searchParams.get("setting");
	if (settingKey && pattern.startsWith("/settings")) {
		const label = (i18n.ts as Record<string, unknown>)[settingKey];
		if (typeof label === "string") names.push(label);
	}

	return { kind: "page", label: names.join(" > "), to };
}
