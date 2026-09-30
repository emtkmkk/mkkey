/**
 * @packageDocumentation
 *
 * もこきーの画面の URL から画面名を引く純粋な関数（画面の HTML のタイトルと OGP に使う）。
 *
 * @remarks
 * 画面名の表はクライアントのビルド時に作られる（`packages/client/vite.route-titles.ts` が出す `route-titles.json`）。
 * URL の形の書き方はクライアントのルーター（nirax）と同じ：
 * - `:name` は 1 区切り（必須）、`:name?` は省略可
 * - `:name(*)` はそれ以降すべて（`:name(*)?` なら省略可）
 * - `(*)` だけの区切りも、それ以降すべて
 *
 * @internal
 */

/** 表の 1 件（サーバー用。画面名は日本語の文字に直してある） */
export type RouteTitleJsonEntry = {
	path: string;
	title: string | null;
	parents: string[];
	kind?: "emoji";
	/** 今までどおりの表示にする画面（OGP を持つ画面、中身が特に無い URL） */
	keep?: boolean;
};

/** `route-titles.json` の中身 */
export type RouteTitleTable = {
	entries: RouteTitleJsonEntry[];
	/** 設定項目のキー → 名前 */
	settingLabels: Record<string, string>;
};

/** URL から引いた画面 */
export type RouteTitleMatch =
	| { kind: "page"; label: string }
	| { kind: "emoji"; emoji: string };

/**
 * URL の形と、実際の URL のパスを照らし合わせる。
 *
 * @param pattern - URL の形（例：`/tags/:tag`）
 * @param pathname - 実際のパス（例：`/tags/mkkey`）
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
	// 形より区切りが多い URL は合わない（足りない分は、上で省略可のときだけ通している）
	return parts.length > want.length ? null : params;
}

/**
 * URL から画面名を引く。
 *
 * @remarks
 * - 表の先に書いたものから順に照らし合わせ、最初に合ったもので決める（表はクライアントのルーターと同じ順）
 * - 最初に合ったのが keep の画面や、名前の無い画面なら null（今までどおりの表示）
 * - 親の画面名を「設定 > タイムライン」のようにつなぐ
 * - 画面名の `{param}` は URL のパラメータに置き換える（例：`#{tag}`）
 * - 設定の画面に `?setting=キー` があれば、その設定項目の名前もつなぐ
 * - 絵文字の情報の画面は、絵文字の名前（`name` か `name@host`）を返す
 *
 * @param table - 画面名の表
 * @param pathname - URL のパス
 * @param search - URL のクエリ（`?` 無しでもよい）
 * @returns 画面（表に無ければ null）
 * @internal
 */
export function resolveRouteTitle(table: RouteTitleTable, pathname: string, search = ""): RouteTitleMatch | null {
	const path = pathname.replace(/\/+$/, "") || "/";
	for (const e of table.entries) {
		const params = matchRoutePattern(e.path, path);
		if (params == null) continue;
		if (e.keep) return null;
		if (e.kind === "emoji") {
			const emoji = params.get("emoji");
			return emoji ? { kind: "emoji", emoji: emoji.replace(/^:|:$/g, "") } : null;
		}
		const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => params.get(k) ?? "");
		if (e.title == null) return null;
		const names = [...e.parents, e.title].map(fill).filter(Boolean);
		if (names.length === 0) return null;
		const settingKey = new URLSearchParams(search).get("setting");
		if (settingKey && e.path.startsWith("/settings") && table.settingLabels[settingKey]) {
			names.push(table.settingLabels[settingKey]);
		}
		return { kind: "page", label: names.join(" > ") };
	}
	return null;
}
