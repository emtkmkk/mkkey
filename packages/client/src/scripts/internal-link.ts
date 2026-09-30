/**
 * @packageDocumentation
 *
 * もこきー自身の URL から、どの画面かを調べる（投稿に貼られた URL の「〇〇に移動」の表示に使う）。
 *
 * @remarks
 * 画面名は、ビルド時に各画面の見出しから作った表（`virtual:route-titles`）から引く。
 * - 表はルーターと同じ順で並んでいる。URL を先頭から照らし合わせ、最初に合ったものを使う
 * - 合ったのが今までどおり Web プレビューを出す画面（keep）や、名前の無い画面なら null を返す
 * - 設定・コントロールパネルの子の画面は「設定 > タイムライン」のように親の名前を付ける
 * - 設定の画面に `?setting=キー` が付いていれば、その設定項目の名前も付ける（設定検索と同じく `i18n.ts[キー]` で引く）
 * - 絵文字の情報の画面は、絵文字の名前を返す（呼び出し側で絵文字の画像と一緒に出す）
 *
 * WARNING: このファイルからルーター（`@/router`）を import しないこと。
 * URL のプレビューの部品から読まれるため、ルーター → os → … → このファイル → ルーター の循環ができ、
 * os の初期化が終わらずにクライアント全体が起動しなくなる（2026-09-30 に実際に起きた）。
 * URL の照らし合わせは、ルーターの代わりに {@link matchRoutePattern} で行う。
 *
 * @internal
 */
import routeTitles, { type RouteLinkTitle } from "virtual:route-titles";
import { url as local } from "@/config";
import { i18n } from "@/i18n";

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

/**
 * URL の形と、実際の URL のパスを照らし合わせる。
 *
 * @remarks
 * 書き方はルーター（nirax）と同じ：`:name` は 1 区切り、`:name?` は省略可、`:name(*)` と `(*)` はそれ以降すべて。
 * NOTE: サーバー側の `packages/backend/src/misc/route-title.ts` の同名の関数と同じ動き。直すときは両方直す。
 *
 * @param pattern - URL の形（例：`/tags/:tag`）
 * @param pathname - 実際のパス
 * @returns 合えばパラメータ、合わなければ null
 * @internal
 */
export function matchRoutePattern(pattern: string, pathname: string): Map<string, string> | null {
	const want = pattern.split("/").filter(Boolean);
	const parts = pathname.split("/").filter(Boolean);
	const params = new Map<string, string>();
	const decode = (s: string) => {
		try {
			return decodeURIComponent(s);
		} catch {
			return s;
		}
	};
	for (let i = 0; i < want.length; i++) {
		const w = want[i];
		const wildcard = w.match(/^(?::(\w+))?\(\*\)(\?)?$/);
		if (wildcard) {
			const rest = parts.slice(i);
			if (rest.length === 0 && wildcard[2] !== "?" && wildcard[1] != null) return null;
			if (wildcard[1] && rest.length > 0) params.set(wildcard[1], decode(rest.join("/")));
			return params;
		}
		const param = w.match(/^:(\w+)(\?)?$/);
		if (param) {
			if (parts[i] == null) {
				if (param[2] === "?") continue;
				return null;
			}
			params.set(param[1], decode(parts[i]));
			continue;
		}
		if (parts[i] !== w) return null;
	}
	// 形より区切りが多い URL は合わない
	return parts.length > want.length ? null : params;
}

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
	const path = u.pathname.replace(/\/+$/, "") || "/";

	for (const entry of routeTitles) {
		const params = matchRoutePattern(entry.path, path);
		if (params == null) continue;
		// 最初に合った画面で決める（ルーターも最初に合った画面を開く）
		if (entry.keep) return null;

		if (entry.kind === "emoji") {
			const name = params.get("emoji");
			return name ? { kind: "emoji", emoji: `:${name.replace(/^:|:$/g, "")}:`, to } : null;
		}
		if (entry.title == null) return null;

		const names = [...entry.parents, entry.title]
			.map((t) => titleText(t, params))
			.filter((x): x is string => !!x);
		if (names.length === 0) return null;

		// 設定の画面で、特定の設定項目を指しているとき
		const settingKey = u.searchParams.get("setting");
		if (settingKey && entry.path.startsWith("/settings")) {
			const label = (i18n.ts as Record<string, unknown>)[settingKey];
			if (typeof label === "string") names.push(label);
		}
		return { kind: "page", label: names.join(" > "), to };
	}
	return null;
}
