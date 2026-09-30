/**
 * @packageDocumentation
 *
 * ビルド時に作る「URL の形 → 画面名」の表（`vite.route-titles.ts` のプラグインが出す仮想モジュール）の型。
 *
 * @internal
 */
declare module "virtual:route-titles" {
	/** 画面名（言語のキーか、そのままの文字。文字には `{param}` を書ける） */
	export type RouteLinkTitle = { key?: string; text?: string };

	/** 表の 1 件 */
	export type RouteTitleEntry = {
		/** 親をつないだ URL の形（例：`/settings/timeline`、`/tags/:tag`） */
		path: string;
		/** 画面名 */
		title: RouteLinkTitle | null;
		/** 親の画面名（例：設定 > タイムライン の「設定」） */
		parents: RouteLinkTitle[];
		/** 特別な表示をする画面の種類 */
		kind?: "emoji";
		/** 今までどおり Web プレビューを出す画面 */
		keep?: boolean;
	};

	const entries: RouteTitleEntry[];
	export default entries;
}
