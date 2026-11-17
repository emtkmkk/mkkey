/**
 * @packageDocumentation
 *
 * ポップアップ（ダイアログ・メニュー・画像ビューアなど）を、ブラウザやスマホの「戻る」操作で閉じられるようにする仕組み。
 *
 * @remarks
 * ## 考え方
 * 開いているポップアップを積み重ね（スタック）として管理し、1 つ開くごとに同じ URL の履歴（目印付き）を 1 つ積む。
 * 「戻る」で目印の履歴から離れたら、その分だけ上から順にポップアップを閉じる。
 * ×ボタンなど、ふつうの方法で閉じたときは、積んだ履歴を自分で戻して余分な履歴を残さない。
 *
 * ```
 * 履歴:  [ページ] [目印1] [目印2]   ← 今いる位置（ポップアップ 2 枚）
 * 戻る:  [ページ] [目印1]           → 上のポップアップだけ閉じる。ページは移らない
 * ```
 *
 * 目印の履歴には今の `history.state`（ルーターが付けたページの `key`）をそのまま引き継ぐ。
 * そのため、目印の上を行き来してもルーターは同じページと判断し、スクロール位置も保たれる。
 *
 * ## 履歴の操作をまとめて行う理由
 * `history.back()` / `history.go()` は呼んだ時点では反映されず、後から `popstate` が届く。
 * ポップアップごとにばらばらに戻すと、続けて閉じたときや、閉じると同時にページ移動したときに、
 * 戻し忘れや移動の取り消しが起きる。そこで、
 *
 * - 開閉の直後にはすぐ履歴を触らず、少し後で「開いている数」と「積んだ目印の数」を合わせる（{@link reconcile}）。
 *   メニューを閉じてすぐ確認ダイアログを開く、のような入れ替わりでは履歴を動かさずに済む。
 * - 自分で戻している最中（`backPending`）は、ルーターの `pushState` / `replaceState` を待たせ、戻り終わってから行う。
 * - ポップアップから別ページへ移るときは、目印の履歴を新しいページで置き換える（{@link takeOverForNavigation}）。
 *   履歴に「同じページ」が余計に残らない。
 *
 * ## ルーターとの関係
 * `router.ts` の popstate 処理は、最初に {@link handlePopState} を呼ぶ。true が返ったら、それは
 * ポップアップを閉じただけ（または自分で戻した）なので、ルーターはページを動かさない。
 *
 * NOTE: ポップアップを開いたまま、ほかの理由で複数段の目印より上へページ移動すると、
 * 下の目印が「死んだ履歴」として残ることがある。そこへ戻ってきたときは自動で 1 段ずつ飛ばす。
 * そのため、死んだ履歴へ「進む」で入ると、元のページへ戻される（めったに起きないので許容している）。
 *
 * @public
 */

/** 目印を `history.state` に入れるときのキー名（ほかの用途と重ならない名前にする） */
const STATE_KEY = "closeOnBack";

/**
 * このページ読み込みの識別子
 *
 * @remarks
 * 再読み込みすると `history.state` に前回の目印が残っていることがある。
 * 識別子が違う目印は、ただのページの履歴（段数 0）として扱う。
 */
const SESSION = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 目印の中身 */
interface Marker {
	session: string;
	/** 何段目の目印か（1 始まり。ページの履歴は 0） */
	depth: number;
}

/** 開いているポップアップ 1 つ分 */
interface Entry {
	/**
	 * 「戻る」が来たときに閉じる処理
	 *
	 * @returns 閉じられなかった（閉じてはいけない）なら false。そのときは開いたままとして扱い直す
	 */
	onBack: () => boolean | void;
}

/**
 * 登録したポップアップの操作
 *
 * @public
 */
export interface CloseOnBackHandle {
	/** ふつうの方法で閉じたときに呼ぶ。何回呼んでもよい */
	release: () => void;
}

/** 開いているポップアップ（後ろほど上） */
const stack: Entry[] = [];
/** 積んである目印の段数。今いる位置はこの段の目印（0 ならページの履歴）であるとみなす */
let depth = 0;
/** 自分で `history.go()` して、まだ `popstate` が届いていない */
let backPending = false;
/** 戻り終わってから行う履歴操作（ルーターの push / replace） */
const afterBack: (() => void)[] = [];
/** {@link reconcile} の予約済みタイマー */
let reconcileTimer: number | null = null;

/**
 * 今いる履歴の段数を読む
 *
 * @param state - 調べる `history.state`
 * @returns 目印なら段数、それ以外（ページの履歴・前回の読み込みの目印）なら 0
 */
function readDepth(state: unknown): number {
	const marker = (state as Record<string, unknown> | null)?.[STATE_KEY] as
		| Marker
		| undefined;
	return marker?.session === SESSION ? marker.depth : 0;
}

/**
 * 目印の履歴を 1 段積む
 *
 * @remarks
 * 今の state（ルーターの `key` など）をそのまま引き継ぐので、ルーターからは同じページに見える。
 */
function pushMarker(): void {
	depth++;
	const marker: Marker = { session: SESSION, depth };
	window.history.pushState(
		{ ...(window.history.state ?? {}), [STATE_KEY]: marker },
		"",
		location.href,
	);
}

/** {@link reconcile} を少し後に予約する（開閉の入れ替わりをまとめるため） */
function scheduleReconcile(): void {
	if (reconcileTimer != null) return;
	reconcileTimer = window.setTimeout(() => {
		reconcileTimer = null;
		reconcile();
	}, 0);
}

/**
 * 開いているポップアップの数と、積んだ目印の段数を合わせる
 *
 * @remarks
 * - 目印が多すぎる（閉じた）→ その段数だけ `history.go()` で戻る。
 * - 目印が足りない（開いた）→ 足りない分を積む。
 * - 今いる位置が想定と違う（ほかの理由で履歴が動いた）ときは、今の位置を基準に数え直す。
 */
function reconcile(): void {
	if (backPending) return;
	const current = readDepth(window.history.state);
	if (current !== depth) depth = current;

	if (stack.length < depth) {
		const n = depth - stack.length;
		depth = stack.length;
		backPending = true;
		window.history.go(-n);
		return;
	}
	while (stack.length > depth) pushMarker();
}

/**
 * ポップアップを開いたときに登録する
 *
 * @remarks
 * - 開いた操作（クリックなど）の流れの中で呼べば、その場で目印を積む。
 *   ブラウザによっては、操作を伴わずに積んだ履歴を「戻る」で飛ばすため、なるべくその場で積む。
 * - 自分で戻している最中や、閉じた直後でまだ数を合わせていないときは、{@link reconcile} に任せる。
 *
 * @param onBack - 「戻る」が来たときに閉じる処理。閉じられないなら false を返す
 * @returns 閉じたときに呼ぶ `release` を持つ操作
 *
 * @example
 * ```ts
 * const handle = registerCloseOnBack(() => viewer.close());
 * viewer.on("close", () => handle.release());
 * ```
 *
 * @public
 */
export function registerCloseOnBack(
	onBack: () => boolean | void,
): CloseOnBackHandle {
	const entry: Entry = { onBack };
	stack.push(entry);

	if (
		!backPending &&
		reconcileTimer == null &&
		readDepth(window.history.state) === depth &&
		stack.length === depth + 1
	) {
		pushMarker();
	} else {
		scheduleReconcile();
	}

	return {
		release: () => {
			const i = stack.indexOf(entry);
			if (i === -1) return;
			stack.splice(i, 1);
			scheduleReconcile();
		},
	};
}

/**
 * ルーターの `popstate` 処理の最初に呼ぶ
 *
 * @remarks
 * - 自分で戻した結果なら、待たせていた履歴操作を行い、ルーターには何もさせない。
 * - 目印から下へ戻ったなら、その段数だけ上からポップアップを閉じる。
 *   同じページの中での移動なら、ルーターには何もさせない。
 * - 死んだ目印（開いているポップアップより多い段）に来たら、ページの履歴まで飛ばす。
 *
 * @param event - popstate イベント
 * @param currentKey - ルーターが今表示しているページの key
 * @returns true ならルーターはこの popstate を無視する（ページを動かさない）
 * @public
 */
export function handlePopState(
	event: PopStateEvent,
	currentKey: string | undefined,
): boolean {
	const landed = readDepth(event.state);

	if (backPending) {
		backPending = false;
		depth = landed;
		// 戻っている間に待たせた履歴操作（ページ移動など）をここで行う
		for (const fn of afterBack.splice(0)) fn();
		reconcile();
		return true;
	}

	const samePage = event.state?.key != null && event.state.key === currentKey;

	if (landed < depth) {
		// 戻った段数だけ、上から閉じる
		const count = Math.min(depth - landed, stack.length);
		const closing = stack.splice(stack.length - count, count).reverse();
		depth = landed;
		for (const entry of closing) {
			if (entry.onBack() === false) {
				// 閉じられないものは開いたままとして戻し、目印を積み直す
				stack.push(entry);
			}
		}
		if (stack.length !== depth) scheduleReconcile();
		return samePage;
	}

	if (landed > stack.length) {
		// 死んだ目印に来た。開いている分の段まで戻る
		depth = landed;
		scheduleReconcile();
		return samePage;
	}

	depth = landed;
	return false;
}

/**
 * ルーターがページを移動（push）するときに呼ぶ
 *
 * @remarks
 * 目印の上にいるなら、その目印を新しいページで置き換える（`replaceState` を使う）よう知らせる。
 * ポップアップから別ページへ移ったときに、履歴へ「同じページ」が余計に残らないようにするため。
 * 開いたままのポップアップがあれば、後で新しいページの上に目印を積み直す。
 *
 * @returns 目印を置き換えるなら true（呼び出し側は `pushState` ではなく `replaceState` を使う）
 * @public
 */
export function takeOverForNavigation(): boolean {
	const current = readDepth(window.history.state);
	if (current === 0 || current !== depth) return false;
	depth = 0;
	if (stack.length > 0) scheduleReconcile();
	return true;
}

/**
 * ルーターの履歴操作を、自分で戻している最中なら戻り終わるまで待たせる
 *
 * @remarks
 * 戻っている途中に `pushState` すると、後から届く「戻る」で移動が取り消されてしまうため。
 *
 * @param fn - 行いたい履歴操作
 * @public
 */
export function runAfterPendingBack(fn: () => void): void {
	if (backPending) {
		afterBack.push(fn);
	} else {
		fn();
	}
}

/**
 * ルーターが `replaceState` するときの state に、今の目印を残す
 *
 * @remarks
 * 目印の上でページ内の置き換え（タブ切り替えなど）をすると、目印が消えて段数が分からなくなるため。
 *
 * @param state - ルーターが入れたい state
 * @returns 目印を足した state
 * @public
 */
export function keepMarker<T extends Record<string, unknown>>(state: T): T {
	const marker = (window.history.state as Record<string, unknown> | null)?.[
		STATE_KEY
	];
	return marker == null ? state : { ...state, [STATE_KEY]: marker };
}

/**
 * PhotoSwipe の lightbox を、開くたびに「戻る」で閉じられるようにする
 *
 * @remarks
 * - `beforeOpen` で登録し、`close` で外す（{@link registerCloseOnBack}）。
 * - PhotoSwipe は ×ボタン・背景クリック・Esc・下スワイプ・`destroy()` のどれで閉じても `close` を出すので、
 *   閉じ方ごとに書き分けなくてよい。
 * - `lightbox.init()` の前に呼ぶ。lightbox の `on` は、開くたびに作られる PhotoSwipe 本体にも引き継がれる。
 *
 * @param lightbox - 対象の lightbox
 * @public
 */
export function bindLightboxCloseOnBack(lightbox: {
	on: (name: "beforeOpen" | "close", fn: () => void) => void;
	pswp?: { close: () => void } | null;
}): void {
	let handle: CloseOnBackHandle | null = null;
	lightbox.on("beforeOpen", () => {
		const pswp = lightbox.pswp;
		handle?.release();
		handle = registerCloseOnBack(() => pswp?.close());
	});
	lightbox.on("close", () => {
		handle?.release();
		handle = null;
	});
}
