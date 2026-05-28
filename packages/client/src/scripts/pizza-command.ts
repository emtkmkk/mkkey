/**
 * @packageDocumentation
 *
 * ニコニコ動画の `@ピザ` を元ネタとしたネタコマンド機能。
 *
 * 投稿フォームの本文に `@ピザ` または `＠ピザ`（全角アット）を含む状態で
 * 投稿ボタンを押した瞬間に、重み付きランダムで選んだピザ関連 URL を
 * 投稿者本人のブラウザの新規タブで開くだけのフロントエンド完結機能。
 *
 * @remarks
 * NOTE: サーバー側・連合先・他ユーザーには一切影響しない。投稿処理本体にも
 *       干渉せず、本文加工も行わない。
 * NOTE: 投稿の成否を待たずに新規タブを開く。失敗してもタブは閉じない。
 * WARNING: `window.open` はユーザー操作（クリック/キー押下）の同期実行中に
 *          呼ばれないとブラウザのポップアップブロックの対象になる。
 *          `triggerPizzaIfNeeded` は async 関数内であっても、最初の `await` より
 *          前の同期区間で呼び出すこと。
 * NB: 判定は本文のみを対象とする。返信先・引用元・Renote 元・OGP・MFM 展開後の
 *     内部テキストなどは含めない（仕様書 §4.4）。
 * NB: `@pizza` / `＠pizza`（半角ローマ字）は v1 では対象外。
 *
 * @internal
 */

/**
 * ピザリンクのカテゴリ種別。
 *
 * @remarks
 * - `main`: 国内の主要宅配ピザ公式サイト
 * - `delivery`: 出前館・Uber Eats などの横断デリバリー
 * - `regional`: 国内地域チェーン
 * - `restaurant`: 本格ピッツァ・レストラン系
 * - `search`: 検索サイト・地図検索
 * - `overseas`: 海外メジャーピザチェーン
 * - `joke`: ネタ枠
 *
 * @public
 */
export type PizzaKind =
	| "main"
	| "delivery"
	| "regional"
	| "restaurant"
	| "search"
	| "overseas"
	| "joke";

/**
 * 候補となるピザ関連リンク 1 件分の情報。
 *
 * @remarks
 * `weight` は重み付きランダム選定時の相対比重。値が大きいほど選ばれやすい。
 *
 * @public
 */
export type PizzaLink = {
	/** 表示用の名称（ログ・将来のデバッグ用途）。 */
	name: string;
	/** 開く URL。コード内で固定管理し、ユーザー入力からは生成しない（仕様書 §17.2）。 */
	url: string;
	/** 相対的な重み（>= 0）。0 のものは事実上選ばれない。 */
	weight: number;
	/** カテゴリ種別。 */
	kind: PizzaKind;
};

// #region 候補URLリスト

/**
 * `@ピザ` 発火時に選ばれる候補 URL の一覧。
 *
 * @remarks
 * 重み配分の目安:
 * - 国内実用系（main / delivery）: 多め
 * - 国内地域チェーン（regional）: そこそこ
 * - 海外メジャー系（overseas）: たまに
 * - ネタ枠（joke）: たまに
 *
 * @public
 */
export const pizzaLinks: PizzaLink[] = [
	// =========================
	// 国内・本命枠
	// =========================
	{ name: "ドミノ・ピザ", url: "https://www.dominos.jp/", weight: 60, kind: "main" },
	{ name: "ピザハット", url: "https://www.pizzahut.jp/", weight: 60, kind: "main" },
	{ name: "ピザーラ", url: "https://www.pizza-la.co.jp/", weight: 60, kind: "main" },
	{ name: "ナポリの窯", url: "https://www.napolipizza.jp/", weight: 24, kind: "main" },

	// =========================
	// 国内・横断検索 / デリバリー枠
	// =========================
	{ name: "出前館 ピザ", url: "https://demae-can.com/chain/list/pizza/", weight: 32, kind: "delivery" },
	{ name: "Uber Eats ピザ", url: "https://www.ubereats.com/jp/near-me/pizza", weight: 24, kind: "delivery" },
	{ name: "Google Maps ピザ検索", url: "https://www.google.com/maps/search/%E3%83%94%E3%82%B6", weight: 16, kind: "search" },

	// =========================
	// 国内・地域チェーン枠
	// =========================
	{ name: "アオキーズ・ピザ", url: "https://www.aokispizza.co.jp/", weight: 7, kind: "regional" },
	{ name: "ピザ・リトルパーティー", url: "https://www.litopa.com/", weight: 7, kind: "regional" },
	{ name: "ピザ・サントロペ", url: "https://www.pizza-saint-tropez.co.jp/", weight: 6, kind: "regional" },
	{ name: "ピザレボ", url: "https://www.pizzarevo.com/", weight: 5, kind: "regional" },
	{ name: "シカゴピザ", url: "https://www.chicago-pizza.com/", weight: 5, kind: "regional" },
	{ name: "ストロベリーコーンズ", url: "https://www.strawberrycones.com/", weight: 5, kind: "regional" },
	{ name: "That's PIZZA（大阪）", url: "https://thats-pizza.org/", weight: 4, kind: "regional" },
	{ name: "ピザポケット", url: "https://www.pizza-pockets.jp/", weight: 4, kind: "regional" },
	{ name: "ピザ・ロイヤルハット", url: "https://royalhat.online/", weight: 4, kind: "regional" },
	{ name: "ピザクック", url: "https://www.pizzacooc.com/", weight: 4, kind: "regional" },
	{ name: "ピザ テン.フォー", url: "https://www.tenfour.co.jp/", weight: 4, kind: "regional" },
	{ name: "ピザ・カリフォルニア", url: "https://www.pizza-cali.net/", weight: 3, kind: "regional" },

	// =========================
	// 国内・本格ピッツァ / レストラン・ファミレス系
	// =========================
	{ name: "サイゼリヤ", url: "https://www.saizeriya.co.jp/", weight: 4, kind: "restaurant" },
	{ name: "サルヴァトーレ クオモ", url: "https://www.salvatore.jp/delivery.html", weight: 4, kind: "restaurant" },
	{ name: "ジョリーパスタ", url: "https://www.jolly-pasta.co.jp/", weight: 3, kind: "restaurant" },
	{ name: "カプリチョーザ", url: "https://capricciosa.com/", weight: 3, kind: "restaurant" },
	{ name: "食べログ ピザ検索", url: "https://tabelog.com/rstLst/pizza/", weight: 3, kind: "search" },
	{ name: "ぐるなび ピザ検索", url: "https://r.gnavi.co.jp/area/jp/rs/?fw=%E3%83%94%E3%82%B6", weight: 2, kind: "search" },

	// =========================
	// 海外メジャー系
	// 実用ではなく「海外に飛ばされる」ネタ寄り
	// =========================
	{ name: "Papa Johns", url: "https://www.papajohns.com/", weight: 4, kind: "overseas" },
	{ name: "Little Caesars", url: "https://littlecaesars.com/", weight: 4, kind: "overseas" },
	{ name: "California Pizza Kitchen", url: "https://www.cpk.com/", weight: 3, kind: "overseas" },
	{ name: "Round Table Pizza", url: "https://www.roundtablepizza.com/", weight: 3, kind: "overseas" },
	{ name: "Marco's Pizza", url: "https://www.marcos.com/", weight: 3, kind: "overseas" },
	{ name: "Sbarro", url: "https://sbarro.com/", weight: 3, kind: "overseas" },
	{ name: "PizzaExpress", url: "https://www.pizzaexpress.com/", weight: 3, kind: "overseas" },
	{ name: "MOD Pizza", url: "https://modpizza.com/", weight: 3, kind: "overseas" },
	{ name: "&pizza", url: "https://andpizza.com/", weight: 2, kind: "overseas" },
	{ name: "Pizza Pilgrims", url: "https://www.pizzapilgrims.co.uk/", weight: 2, kind: "overseas" },
	{ name: "Jet's Pizza", url: "https://www.jetspizza.com/", weight: 2, kind: "overseas" },
	{ name: "Papa Murphy's", url: "https://www.papamurphys.com/", weight: 2, kind: "overseas" },

	// =========================
	// ネタ枠
	// =========================
	{ name: "ピザ - Wikipedia", url: "https://ja.wikipedia.org/wiki/%E3%83%94%E3%82%B6", weight: 3, kind: "joke" },
	{ name: "ピザ協議会", url: "https://pizzakyogikai.gr.jp/", weight: 3, kind: "joke" },
	{ name: "ピザの日（11月20日）", url: "https://pizzakyogikai.gr.jp/pizzaday.html", weight: 2, kind: "joke" },
	{ name: "ピザポテト", url: "https://www.calbee.co.jp/pizza/", weight: 3, kind: "joke" },
	{ name: "ピザまん（手作りレシピ）", url: "https://www.imuraya.co.jp/recipe/nikuman-anman/pizzapizza_man/", weight: 2, kind: "joke" },
	{ name: "クックパッド ピザ", url: "https://cookpad.com/search/%E3%83%94%E3%82%B6", weight: 2, kind: "joke" },
	{ name: "DELISH KITCHEN ピザ", url: "https://delishkitchen.tv/categories/9913", weight: 2, kind: "joke" },
	{ name: "クラシル ピザ", url: "https://www.kurashiru.com/search?query=%E3%83%94%E3%82%B6", weight: 2, kind: "joke" },
	{ name: "楽天レシピ ピザ", url: "https://recipe.rakuten.co.jp/word/%E3%83%94%E3%82%B6/", weight: 2, kind: "joke" },
	{ name: "コストコ", url: "https://www.costco.co.jp/", weight: 2, kind: "joke" },
	{ name: "業務スーパー", url: "https://www.gyomusuper.jp/", weight: 2, kind: "joke" },
	{ name: "カルディ", url: "https://www.kaldi.co.jp/", weight: 2, kind: "joke" },
	{ name: "楽天市場 ピザ", url: "https://search.rakuten.co.jp/search/mall/%E3%83%94%E3%82%B6/", weight: 2, kind: "joke" },
	{ name: "Amazon ピザ", url: "https://www.amazon.co.jp/s?k=%E3%83%94%E3%82%B6", weight: 1, kind: "joke" },
	{ name: "Pizza - Emojipedia", url: "https://emojipedia.org/pizza", weight: 1, kind: "joke" },

	// =========================
	// ネタ枠（イラスト素材）
	// =========================
	{ name: "いらすとや ピザ", url: "https://www.irasutoya.com/search?q=%E3%83%94%E3%82%B6", weight: 1, kind: "joke" },
	{ name: "写真AC ピザ", url: "https://www.photo-ac.com/main/search?q=%E3%83%94%E3%82%B6", weight: 1, kind: "joke" },

	// =========================
	// ネタ枠（Steamのピザゲー）
	// =========================
	{ name: "Pizza Tower (Steam)", url: "https://store.steampowered.com/app/2231450/Pizza_Tower/", weight: 2, kind: "joke" },
	{ name: "Pineapple on pizza (Steam)", url: "https://store.steampowered.com/app/2263010/Pineapple_on_pizza/", weight: 1, kind: "joke" },
	{ name: "Good Pizza, Great Pizza (Steam)", url: "https://store.steampowered.com/app/770810/Good_Pizza_Great_Pizza__Cooking_Simulator_Game/", weight: 2, kind: "joke" },
	{ name: "ピザとお酒と萃香ちゃんと！ (Steam)", url: "https://store.steampowered.com/app/4111230/", weight: 1, kind: "joke" },

	// =========================
	// ネタ枠（教材・特殊）
	// =========================
	{ name: "オリジナルピザ作り（熊本県教材）", url: "https://www.kumamoto-kmm.ed.jp/kyouzai/web/Original-pizza/?param=@pizza&K", weight: 1, kind: "joke" },
];

// #endregion 候補URLリスト

// #region 判定・選定ヘルパー

/**
 * ノート本文に `@ピザ` 系のコマンドが含まれるかを判定する。
 *
 * @remarks
 * - 半角アット (`@ピザ`) と全角アット (`＠ピザ`) の両方をサポートする。
 * - `@pizza` / `＠pizza` のように「ピザ」が漢字以外（ローマ字）の場合は対象外。
 *   これは v1 仕様（仕様書 §4.3 / §19）に従う。
 * - 部分一致でよい（例: `今日は@ピザするか` も発火対象）。
 *
 * @param text - 判定対象のテキスト。`null` / `undefined` / 空文字は常に `false`。
 * @returns `@ピザ` 系の文字列を含むなら `true`。
 *
 * @public
 */
export function isPizzaCommand(text?: string | null): boolean {
	if (!text) return false;
	return text.includes("@ピザ") || text.includes("＠ピザ");
}

/**
 * `weight` 付き配列から重み付きランダムで 1 件選ぶ。
 *
 * @remarks
 * NOTE: `weight` 合計が 0 以下のときは、フォールバックとして配列末尾の要素を返す。
 *       これは「すべての候補が weight=0 で潰されていても落ちない」ための安全側挙動。
 * NB: 入力が空配列の場合は呼び出し側で弾くこと（本関数では `undefined as never` 相当を返さない）。
 *
 * @typeParam T - `weight: number` を持つ任意のオブジェクト型。
 * @param items - 候補配列（要素 1 件以上必須）。
 * @returns 重み付きで選ばれた 1 件。
 *
 * @public
 */
export function pickWeightedRandom<T extends { weight: number }>(items: T[]): T {
	const total = items.reduce((sum, item) => sum + Math.max(item.weight, 0), 0);

	// すべて weight 0 / 負値などのケースの安全側フォールバック
	if (total <= 0) {
		return items[items.length - 1];
	}

	let random = Math.random() * total;

	for (const item of items) {
		random -= Math.max(item.weight, 0);
		if (random < 0) {
			return item;
		}
	}

	return items[items.length - 1];
}

// #endregion 判定・選定ヘルパー

// #region 重複抑止（localStorage シャッフル）

/**
 * 既出 URL を記録する localStorage キー。
 *
 * @remarks
 * NOTE: ブラウザ内（=ドメイン単位）で共有する。アカウント切り替えしても
 *       同じブラウザでは同じ状態を共有するが、本機能はネタなのでそれで問題ない。
 *
 * @internal
 */
const PIZZA_SEEN_STORAGE_KEY = "mkkey:pizza-command:seen";

/**
 * localStorage 読み書き失敗時に使うメモリフォールバック。
 *
 * @remarks
 * NOTE: Safari のプライベートモードや localStorage 容量超過などで読み書きが
 *       失敗するケースに備え、最低限「同一セッション内では重複しない」状態を
 *       メモリで保つ。リロードで消えるのは仕様とする。
 *
 * @internal
 */
let inMemorySeenUrls: string[] | null = null;

/**
 * localStorage から既出 URL リストを読み出す。
 *
 * @remarks
 * NOTE: JSON が壊れている / 配列ではない / 中身が文字列でない、いずれの場合も
 *       「履歴なし」として扱い、ストレージ側もリセットする。
 *
 * @returns 既出 URL の配列（読み取り失敗時はメモリフォールバック or 空配列）。
 * @internal
 */
function loadSeenUrls(): string[] {
	try {
		const raw = localStorage.getItem(PIZZA_SEEN_STORAGE_KEY);
		if (raw == null) return inMemorySeenUrls ?? [];

		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		// 中身が文字列だけになるように防御的にフィルタ
		return parsed.filter((x): x is string => typeof x === "string");
	} catch {
		// localStorage 利用不可（プライベートモード等）のケース
		return inMemorySeenUrls ?? [];
	}
}

/**
 * 既出 URL リストを localStorage に書き込む。
 *
 * @remarks
 * NOTE: 書き込み失敗時はメモリフォールバックに保持する。
 *
 * @param urls - 保存する既出 URL の配列。
 * @internal
 */
function saveSeenUrls(urls: string[]): void {
	inMemorySeenUrls = urls;
	try {
		localStorage.setItem(PIZZA_SEEN_STORAGE_KEY, JSON.stringify(urls));
	} catch {
		// noop: メモリフォールバックのみで継続する
	}
}

/**
 * 現在の `pizzaLinks` を踏まえて「未表示の候補」を返す。
 *
 * @remarks
 * - 既出リストのうち、現在の `pizzaLinks` に存在しないものは「削除済み」とみなして
 *   結果のフィルタからは使わない。`pizzaLinks` の更新（追加/削除）に追従できる。
 * - 全件出し終わっていたら、空配列を返す（呼び出し側でリセット判定する）。
 *
 * @param seenUrls - 既出 URL の配列。
 * @returns まだ表示していない `PizzaLink` の配列。
 * @internal
 */
function getUnseenLinks(seenUrls: readonly string[]): PizzaLink[] {
	const seenSet = new Set(seenUrls);
	return pizzaLinks.filter((link) => !seenSet.has(link.url));
}

// #endregion 重複抑止（localStorage シャッフル）

// #region 発火エントリポイント

/**
 * ノート本文を渡し、`@ピザ` 系コマンドを含んでいたらピザ関連 URL を新規タブで開く。
 *
 * @remarks
 * `MkPostForm.vue` の `post()` 冒頭から、最初の `await` より前の同期区間で
 * 呼び出すことを想定している。
 *
 * 重複抑止:
 * - 一度開いた URL は localStorage に記録され、`pizzaLinks` の全候補が出尽くす
 *   までは再選定されない（「山札方式」のシャッフル）。
 * - 全件出し終わると履歴をリセットして、再び全候補が対象になる。
 * - `pizzaLinks` の編集（追加・削除・URL 変更）にも追従する。削除された URL の
 *   履歴は次回読み出し時に自動的に意味を失う。
 *
 * NB: `window.open` はユーザー操作の同期実行中に呼ばないとポップアップブロック
 *     される。`async` 関数内であっても `await` を挟む前に呼ぶこと。
 * NOTE: `noopener,noreferrer` を指定して、開いたページから元タブを操作される
 *       経路を塞いでいる。
 * NOTE: 投稿成否は判定に使わない。タブを開いた後に投稿が失敗してもタブは
 *       閉じない。
 * NOTE: localStorage はドメイン単位で共有される。複数アカウントを切り替えても
 *       履歴は共通になるが、本機能はネタなので許容する。
 *
 * @param text - 投稿本文（ユーザー入力の生テキスト）。
 *
 * @public
 */
export function triggerPizzaIfNeeded(text?: string | null): void {
	if (!isPizzaCommand(text)) return;
	if (pizzaLinks.length === 0) return;

	const seenUrls = loadSeenUrls();
	let candidates = getUnseenLinks(seenUrls);

	// 全件出尽くしたら履歴をリセットしてもう一周。
	// NOTE: ここで候補が空 = `pizzaLinks` の全 URL を一巡したことを意味する。
	let nextSeen: string[];
	if (candidates.length === 0) {
		candidates = pizzaLinks;
		nextSeen = [];
	} else {
		// 削除済み URL の履歴を掃除して持ち越す
		// NOTE: 現在の `pizzaLinks` の URL 集合に含まれるものだけを残す。
		const validUrls = new Set(pizzaLinks.map((l) => l.url));
		nextSeen = seenUrls.filter((url) => validUrls.has(url));
	}

	const selected = pickWeightedRandom(candidates);
	saveSeenUrls([...nextSeen, selected.url]);

	// NOTE: 戻り値の Window 参照は保持しない。`noopener` 指定で window.open は null を返す。
	window.open(selected.url, "_blank", "noopener,noreferrer");
}

// #endregion 発火エントリポイント
