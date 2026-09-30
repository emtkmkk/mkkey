/**
 * @packageDocumentation
 *
 * ビルド時に「URL の形 → 画面名」の表を作る Vite プラグイン。
 *
 * @remarks
 * もこきー自身の URL が投稿に貼られたとき、Web プレビューの代わりに「〇〇に移動」と出すため（アプリ内）と、
 * その画面の HTML のタイトル・OGP に画面名を入れるため（サーバー）に使う。
 *
 * 画面名は新しく書かず、各画面が自分で持っている見出し（`definePageMetadata` の `title`）を読み取る。
 * - `src/router.ts` を TypeScript の構文木として読み、ルートの入れ子（設定・コントロールパネルの子など）と、
 *   それぞれが読み込む画面のファイルを取り出す
 * - 画面のファイルの `definePageMetadata` の `title` が、`i18n.ts.キー` か文字列のときだけ画面名として使う。
 *   中身で変わる名前（ユーザー名、リスト名など）は読み取らない
 * - ルートの定義に `linkTitle` があれば、それを優先する（中身で名前を切り替える画面の分を手で指定する）
 * - `keepLinkPreview: true` のルートは `keep` の印を付ける（今までどおり Web プレビューを出す）
 * - 画面名が無いルートや `keep` のルートも、ルーターと同じ順で表に入れる。URL を先頭から照らし合わせて最初に合ったものを使うので、
 *   ルーターが別の画面として扱う URL を、うっかり後ろの画面の形に合わせてしまわないようにするため
 * - `linkKind: "emoji"` のルートは、絵文字の情報の画面として印を付ける
 *
 * 出力
 * - `virtual:route-titles`（アプリ用）：画面名は言語のキーのまま（見る人の言語で表示するため）
 * - `route-titles.json`（サーバー用。ビルドの出力先に置く）：日本語の文字に直したものと、設定項目の名前
 *
 * @internal
 */
import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import type { Plugin } from "vite";

/** 画面名（言語のキーか、そのままの文字。文字には `{param}` を書ける） */
export type RouteLinkTitle = { key?: string; text?: string };

/** 表の 1 件 */
export type RouteTitleEntry = {
	/** 親をつないだ URL の形（例：`/settings/timeline`、`/tags/:tag`） */
	path: string;
	/** 画面名（絵文字の情報の画面では無いこともある） */
	title: RouteLinkTitle | null;
	/** 親の画面名（例：設定 > タイムライン の「設定」） */
	parents: RouteLinkTitle[];
	/** 特別な表示をする画面の種類 */
	kind?: "emoji";
	/** 今までどおり Web プレビューを出す画面（OGP を持つ画面、中身が特に無い URL） */
	keep?: boolean;
};

const VIRTUAL_ID = "virtual:route-titles";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

// #region router.ts の読み取り

type RawRoute = {
	path: string;
	file: string | null;
	linkTitle: RouteLinkTitle | null;
	keep: boolean;
	kind?: "emoji";
	children: RawRoute[];
};

/**
 * オブジェクトの書き方から、名前で値を取り出す。
 *
 * @param obj - オブジェクトの書き方
 * @param name - プロパティ名
 * @returns 値の式（無ければ undefined）
 */
function prop(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
	for (const p of obj.properties) {
		if (ts.isPropertyAssignment(p) && p.name.getText() === name) return p.initializer;
	}
	return undefined;
}

/**
 * 式の中で最初に出てくる `import("...")` の読み込み先を返す（`page(() => import(...))` や三項演算子の形に対応）。
 *
 * @param node - 式
 * @returns 読み込み先（無ければ null）
 */
function firstImport(node: ts.Node): string | null {
	let found: string | null = null;
	const visit = (n: ts.Node) => {
		if (found) return;
		if (
			ts.isCallExpression(n) &&
			n.expression.kind === ts.SyntaxKind.ImportKeyword &&
			n.arguments[0] &&
			ts.isStringLiteral(n.arguments[0])
		) {
			found = n.arguments[0].text;
			return;
		}
		ts.forEachChild(n, visit);
	};
	visit(node);
	return found;
}

/**
 * `linkTitle: { key: "..." }` / `{ text: "..." }` を読む。
 *
 * @param e - 式
 * @returns 画面名（読めなければ null）
 */
function readLinkTitle(e: ts.Expression | undefined): RouteLinkTitle | null {
	if (e == null || !ts.isObjectLiteralExpression(e)) return null;
	const key = prop(e, "key");
	const text = prop(e, "text");
	const out: RouteLinkTitle = {};
	if (key && ts.isStringLiteralLike(key)) out.key = key.text;
	if (text && ts.isStringLiteralLike(text)) out.text = text.text;
	return out.key || out.text ? out : null;
}

/**
 * ルートの配列の書き方を読む。
 *
 * @param arr - 配列の書き方
 * @returns ルートの一覧
 */
function readRoutes(arr: ts.ArrayLiteralExpression): RawRoute[] {
	const out: RawRoute[] = [];
	for (const el of arr.elements) {
		if (!ts.isObjectLiteralExpression(el)) continue;
		const p = prop(el, "path");
		if (p == null || !ts.isStringLiteralLike(p)) continue;
		const component = prop(el, "component");
		const children = prop(el, "children");
		const keep = prop(el, "keepLinkPreview");
		const kind = prop(el, "linkKind");
		out.push({
			path: p.text,
			file: component ? firstImport(component) : null,
			linkTitle: readLinkTitle(prop(el, "linkTitle")),
			keep: keep?.kind === ts.SyntaxKind.TrueKeyword,
			kind: kind && ts.isStringLiteralLike(kind) && kind.text === "emoji" ? "emoji" : undefined,
			children: children && ts.isArrayLiteralExpression(children) ? readRoutes(children) : [],
		});
	}
	return out;
}

/**
 * router.ts から `export const routes = [...]` を探して読む。
 *
 * @param routerFile - router.ts の場所
 * @returns ルートの一覧
 */
function readRouterFile(routerFile: string): RawRoute[] {
	const sf = ts.createSourceFile(routerFile, fs.readFileSync(routerFile, "utf8"), ts.ScriptTarget.Latest, true);
	let routes: RawRoute[] = [];
	sf.forEachChild((n) => {
		if (!ts.isVariableStatement(n)) return;
		for (const d of n.declarationList.declarations) {
			if (d.name.getText() === "routes" && d.initializer && ts.isArrayLiteralExpression(d.initializer)) {
				routes = readRoutes(d.initializer);
			}
		}
	});
	return routes;
}

// #endregion

// #region 画面のファイルの読み取り

/**
 * 画面のファイルから、決まった画面名（`definePageMetadata` の `title`）を読む。
 *
 * @remarks
 * `title: i18n.ts.キー`（`?? "…"` 付きも可）か `title: "文字"` のときだけ読む。
 * 中身で変わる名前（`user.name` や `computed(...)` の中の三項演算子など）は読まない。
 *
 * @param file - 画面のファイル
 * @returns 画面名（読めなければ null）
 */
function readPageTitle(file: string): RouteLinkTitle | null {
	if (!fs.existsSync(file)) return null;
	const src = fs.readFileSync(file, "utf8");
	const at = src.indexOf("definePageMetadata(");
	if (at < 0) return null;
	const m = src.slice(at, at + 800).match(/title:\s*([^\n]+)/);
	if (m == null) return null;
	const expr = m[1].trim().replace(/,$/, "").trim();
	const key = expr.match(/^i18n\.ts\.(\w+)(?:\s*\?\?\s*"[^"]*")?$/);
	if (key) return { key: key[1] };
	const text = expr.match(/^"([^"]*)"$/);
	if (text) return { text: text[1] };
	return null;
}

/**
 * 設定の画面から、設定項目のキー（`data-setting-key`）を集める。
 *
 * @param dir - 設定の画面の置き場
 * @returns 設定項目のキー
 */
function collectSettingKeys(dir: string): string[] {
	const keys = new Set<string>();
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith(".vue")) continue;
		for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/data-setting-key="(\w+)"/g)) keys.add(m[1]);
	}
	return [...keys];
}

// #endregion

// #region 表の組み立て

/**
 * 入れ子のルートを、親をつないだ表にする。
 *
 * @param routes - ルート
 * @param srcDir - `src` の場所（画面のファイルの基準）
 * @param base - 親の URL の形
 * @param parents - 親の画面名
 * @returns 表
 */
function flatten(routes: RawRoute[], srcDir: string, base = "", parents: RouteLinkTitle[] = []): RouteTitleEntry[] {
	const out: RouteTitleEntry[] = [];
	for (const r of routes) {
		const full = base + r.path;
		const title = r.linkTitle ?? (r.file ? readPageTitle(path.join(srcDir, r.file)) : null);
		// NB: 名前の無い画面・keep の画面も、ルーターと同じ順で入れる（照らし合わせは最初に合ったものを使うため）
		out.push({ path: full, title, parents, ...(r.kind ? { kind: r.kind } : {}), ...(r.keep ? { keep: true } : {}) });
		if (r.children.length > 0) out.push(...flatten(r.children, srcDir, full, title ? [...parents, title] : parents));
	}
	// 同じ URL の形が 2 回書かれていたら、先のものを使う（ルーターも先に書いた方に合う）
	const seen = new Set<string>();
	return out.filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));
}

/**
 * 画面名を日本語の文字にする（サーバー用）。
 *
 * @param t - 画面名
 * @param ja - 日本語の言語データ
 * @returns 文字（引けなければ null）
 */
function toJa(t: RouteLinkTitle | null, ja: Record<string, unknown>): string | null {
	if (t == null) return null;
	if (t.key && typeof ja[t.key] === "string") return ja[t.key] as string;
	return t.text ?? null;
}

// #endregion

/**
 * プラグインを作る。
 *
 * @param opts - `srcDir`：クライアントの src、`ja`：日本語の言語データ
 * @returns Vite のプラグイン
 */
export default function routeTitles(opts: { srcDir: string; ja: Record<string, unknown> }): Plugin {
	const build = () => flatten(readRouterFile(path.join(opts.srcDir, "router.ts")), opts.srcDir);
	return {
		name: "mkkey-route-titles",
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null;
		},
		load(id) {
			if (id !== RESOLVED_VIRTUAL_ID) return null;
			return `export default ${JSON.stringify(build())};`;
		},
		generateBundle() {
			const entries = build();
			const settingLabels = Object.fromEntries(
				collectSettingKeys(path.join(opts.srcDir, "pages/settings"))
					.map((k) => [k, opts.ja[k]])
					.filter(([, v]) => typeof v === "string"),
			);
			this.emitFile({
				type: "asset",
				fileName: "route-titles.json",
				source: JSON.stringify({
					entries: entries.map((e) => ({
						path: e.path,
						title: toJa(e.title, opts.ja),
						parents: e.parents.map((p) => toJa(p, opts.ja)).filter((x): x is string => x != null),
						...(e.kind ? { kind: e.kind } : {}),
						...(e.keep ? { keep: true } : {}),
					})),
					settingLabels,
				}),
			});
		},
	};
}
