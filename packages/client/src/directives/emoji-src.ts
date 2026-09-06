/**
 * @packageDocumentation
 *
 * カスタム絵文字画像の同時読み込み数を制限する Vue ディレクティブ。
 *
 * @remarks
 * 画像ごとの短周期ポーリングは、タブのバックグラウンド化でタイマーが停止した際に
 * 復帰後の処理集中を起こすため使用しない。待機列は load / error イベントだけで進め、
 * DOM から外れた画像は確実に待機列および実行中一覧から除外する。
 *
 * @internal
 */

import type { Directive } from "vue";

/** 同時に読み込むカスタム絵文字画像の上限。 */
const MAX_CONCURRENT_EMOJI_LOADS = 3;

/** 応答しない画像が読み込み枠を占有できる時間。 */
const EMOJI_LOAD_TIMEOUT_MS = 10_000;

/** 絵文字が待機列にある間に表示する画像。 */
const LOADING_IMAGE_URL = "/static-assets/loading.png";

/** ディレクティブが管理する画像要素の状態。 */
interface EmojiLoadState {
	el: HTMLImageElement;
	desiredUrl: string;
	activeUrl: string | null;
	queued: boolean;
	disposed: boolean;
	timeoutId: ReturnType<typeof setTimeout> | null;
	onLoad: () => void;
	onError: () => void;
}

/** 待機中の画像。破棄済みの項目は取り出す際に読み飛ばす。 */
const loadQueue: EmojiLoadState[] = [];

/** 現在ネットワーク読み込み中の画像。 */
const activeLoads = new Set<EmojiLoadState>();

/** 要素ごとの読み込み状態。 */
const states = new WeakMap<HTMLImageElement, EmojiLoadState>();

/**
 * 同時読み込み制御が必要な URL か判定する。
 *
 * @param value - img 要素へ設定する値
 * @returns 絵文字またはプロキシ画像なら true
 * @internal
 */
function isManagedEmojiUrl(value: unknown): value is string {
	return (
		typeof value === "string" &&
		(value.includes("/emoji/") || value.includes("/proxy/"))
	);
}

/**
 * 実行中の読み込み枠を解放する。
 *
 * @param state - 解放対象の状態
 * @returns なし
 * @internal
 */
function releaseActiveLoad(state: EmojiLoadState): void {
	if (!activeLoads.delete(state)) return;

	if (state.timeoutId !== null) {
		clearTimeout(state.timeoutId);
		state.timeoutId = null;
	}
	state.activeUrl = null;
}

/**
 * 待機列から上限まで画像読み込みを開始する。
 *
 * @remarks
 * 読み込み枠は src を設定する前に同期的に確保する。Promise の後で確保すると、
 * 同じイベントループ内の全要素が空き枠を取得できてしまうためである。
 *
 * @returns なし
 * @internal
 */
function drainQueue(): void {
	while (
		activeLoads.size < MAX_CONCURRENT_EMOJI_LOADS &&
		loadQueue.length > 0
	) {
		const state = loadQueue.shift();
		if (!state || state.disposed || !state.queued) continue;

		state.queued = false;
		const requestedUrl = state.desiredUrl;
		if (!isManagedEmojiUrl(requestedUrl)) {
			state.el.src = requestedUrl;
			continue;
		}

		state.activeUrl = requestedUrl;
		activeLoads.add(state);
		state.timeoutId = setTimeout(() => {
			if (state.disposed || state.activeUrl !== requestedUrl) return;

			// 応答しない画像通信を中断し、通常の error 処理で次候補へ進ませる。
			releaseActiveLoad(state);
			state.el.removeAttribute("src");
			state.el.dispatchEvent(new Event("error"));
			drainQueue();
		}, EMOJI_LOAD_TIMEOUT_MS);
		state.el.src = requestedUrl;
	}
}

/**
 * 画像の読み込み完了または失敗を処理する。
 *
 * @param state - イベントが発生した画像の状態
 * @returns なし
 * @internal
 */
function settleLoad(state: EmojiLoadState): void {
	if (!activeLoads.has(state)) return;

	const completedUrl = state.activeUrl;
	releaseActiveLoad(state);

	// 読み込み中に URL が更新された場合は、最新値だけを改めて待機列へ戻す。
	if (
		!state.disposed &&
		state.desiredUrl !== completedUrl &&
		isManagedEmojiUrl(state.desiredUrl)
	) {
		state.queued = true;
		loadQueue.push(state);
	}

	drainQueue();
}

/**
 * 絵文字の読み込み開始を待っていることを画像で示す。
 *
 * @remarks
 * 待機画像の load / error は activeLoads に含まれないため、絵文字用の読み込み枠を
 * 解放しない。相対 URL にして、開発環境や別ドメインでも同じ配布物を参照する。
 *
 * @param state - 待機中の画像要素
 * @returns なし
 * @internal
 */
function showLoadingImage(state: EmojiLoadState): void {
	if (state.el.getAttribute("src") !== LOADING_IMAGE_URL) {
		state.el.src = LOADING_IMAGE_URL;
	}
}

/**
 * 要素の最新 URL を読み込み対象に設定する。
 *
 * @param state - 対象要素の状態
 * @param value - Vue バインディングから渡された URL
 * @returns なし
 * @internal
 */
function scheduleLoad(state: EmojiLoadState, value: unknown): void {
	const nextUrl = typeof value === "string" ? value : "";
	if (
		state.desiredUrl === nextUrl &&
		(state.queued || state.activeUrl === nextUrl)
	) {
		return;
	}

	state.desiredUrl = nextUrl;

	if (!isManagedEmojiUrl(nextUrl)) {
		state.queued = false;
		releaseActiveLoad(state);
		if (nextUrl) {
			state.el.src = nextUrl;
		} else {
			state.el.removeAttribute("src");
		}
		drainQueue();
		return;
	}

	// 実行中なら完了時に desiredUrl の差分を見て再投入する。
	if (activeLoads.has(state) || state.queued) return;

	showLoadingImage(state);
	state.queued = true;
	loadQueue.push(state);
	drainQueue();
}

/**
 * 画像要素の管理を開始する。
 *
 * @param el - 管理対象の img 要素
 * @param value - 最初に読み込む URL
 * @returns なし
 * @internal
 */
function mountEmojiSource(el: HTMLImageElement, value: unknown): void {
	const state: EmojiLoadState = {
		el,
		desiredUrl: "",
		activeUrl: null,
		queued: false,
		disposed: false,
		timeoutId: null,
		onLoad: () => undefined,
		onError: () => undefined,
	};
	state.onLoad = () => settleLoad(state);
	state.onError = () => settleLoad(state);

	// Vue の @error より先に枠を解放し、再描画される代替 URL を安全に投入する。
	el.addEventListener("load", state.onLoad, true);
	el.addEventListener("error", state.onError, true);
	states.set(el, state);
	scheduleLoad(state, value);
}

/**
 * 画像要素を待機列と実行中一覧から取り除く。
 *
 * @param el - 破棄される img 要素
 * @returns なし
 * @internal
 */
function unmountEmojiSource(el: HTMLImageElement): void {
	const state = states.get(el);
	if (!state) return;

	state.disposed = true;
	state.queued = false;
	releaseActiveLoad(state);
	el.removeEventListener("load", state.onLoad, true);
	el.removeEventListener("error", state.onError, true);
	// leave アニメーション中は要素が描画され続けるため、表示中の src は変更しない。
	// 実際に DOM から外れた後の通信中断はブラウザに任せる。
	states.delete(el);
	drainQueue();
}

/** カスタム絵文字画像を上限付きキューで読み込むディレクティブ。 */
const emojiSrc: Directive<HTMLImageElement, string> = {
	mounted(el, binding) {
		mountEmojiSource(el, binding.value);
	},
	updated(el, binding) {
		const state = states.get(el);
		if (state) scheduleLoad(state, binding.value);
	},
	unmounted(el) {
		unmountEmojiSource(el);
	},
};

export default emojiSrc;
