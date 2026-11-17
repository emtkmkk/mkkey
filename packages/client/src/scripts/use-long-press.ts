/**
 * @packageDocumentation
 *
 * ボタンの長押しを検出する小さな仕組み。
 *
 * @remarks
 * - マウスでもタッチでも同じように動くよう、Pointer Events で判定する。
 * - 長押しが成立した後に続けて届く `click` は、ふつうのクリックとして扱わない（{@link LongPressHandlers.consumeClick}）。
 * - 押したまま指やマウスが一定以上動いたら、スクロール等とみなして長押しを取り消す。
 *
 * @public
 */

/** 長押しとみなすまでの時間（ミリ秒） */
const LONG_PRESS_MS = 500;
/** これ以上動いたら長押しを取り消す距離（px） */
const MOVE_TOLERANCE_PX = 10;

/**
 * 要素に付けるイベント処理
 *
 * @public
 */
export interface LongPressHandlers {
	/** `pointerdown` に付ける */
	onPointerDown: (ev: PointerEvent) => void;
	/** `pointermove` に付ける */
	onPointerMove: (ev: PointerEvent) => void;
	/** `pointerup` / `pointerleave` / `pointercancel` に付ける */
	onPointerEnd: () => void;
	/**
	 * `click` の最初に呼ぶ。直前に長押しが成立していたら true を返す（そのクリックは無視する）
	 */
	consumeClick: () => boolean;
}

/**
 * 長押しの検出を作る
 *
 * @remarks
 * `enabled()` が false の間は何もしない（設定がオフのとき用）。
 *
 * @param onLongPress - 長押しが成立したときの処理（押した要素を受け取る。ポップアップの位置合わせ用）
 * @param enabled - 長押しを受け付けるか
 * @returns 要素に付けるイベント処理
 *
 * @example
 * ```ts
 * const press = useLongPress((el) => reply(el), () => defaultStore.state.airReplyLongPressReply);
 * // <button @pointerdown="press.onPointerDown" ... @click="press.consumeClick() || airReply()">
 * ```
 *
 * @public
 */
export function useLongPress(
	onLongPress: (target: HTMLElement | null) => void,
	enabled: () => boolean = () => true,
): LongPressHandlers {
	let timer: number | null = null;
	let fired = false;
	let startX = 0;
	let startY = 0;

	const cancel = () => {
		if (timer != null) {
			window.clearTimeout(timer);
			timer = null;
		}
	};

	return {
		onPointerDown: (ev) => {
			fired = false;
			// 左ボタン（タッチ・ペンは button 0 になる）だけを対象にする
			if (!enabled() || ev.button !== 0) return;
			startX = ev.clientX;
			startY = ev.clientY;
			// イベントの処理が終わると currentTarget は消えるので、押した要素をここで控えておく
			const target =
				ev.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
			cancel();
			timer = window.setTimeout(() => {
				timer = null;
				fired = true;
				// 長押しが成立したことを手触りで伝える（対応端末のみ）
				navigator.vibrate?.(10);
				onLongPress(target);
			}, LONG_PRESS_MS);
		},
		onPointerMove: (ev) => {
			if (timer == null) return;
			if (
				Math.abs(ev.clientX - startX) > MOVE_TOLERANCE_PX ||
				Math.abs(ev.clientY - startY) > MOVE_TOLERANCE_PX
			) {
				cancel();
			}
		},
		onPointerEnd: cancel,
		consumeClick: () => {
			if (!fired) return false;
			fired = false;
			return true;
		},
	};
}
