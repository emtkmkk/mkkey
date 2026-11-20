/**
 * @packageDocumentation
 * 入力欄の前後の装飾幅を、サイズ変更時だけ余白へ反映する。
 * @remarks 非表示からの復帰やフォント変更はResizeObserverで検出し、周期的な幅測定を行わない。
 * @see {@link useInputDecorations}
 * @internal
 */
import { watch, type Ref } from "vue";

/**
 * 入力欄と前後の装飾の寿命に合わせてサイズ監視を登録する。
 * @remarks 幅が0の間は既存の余白を保つ。要素の差し替え・破棄時は監視を解除する。
 * @param inputEl - 余白を設定する入力欄
 * @param prefixEl - 左側の装飾
 * @param suffixEl - 右側の装飾
 * @returns なし
 * @internal
 */
export function useInputDecorations(
	inputEl: Ref<HTMLElement | null | undefined>,
	prefixEl: Ref<HTMLElement | null | undefined>,
	suffixEl: Ref<HTMLElement | null | undefined>,
): void {
	watch([inputEl, prefixEl, suffixEl], ([input, prefix, suffix], _previous, onCleanup) => {
		if (!input) return;
		let active = true;
		const update = () => {
			if (!active) return;
			// 読み取りを先にまとめ、書き込みによる再レイアウトを次の測定に持ち込まない。
			const left = prefix?.offsetWidth ?? 0;
			const right = suffix?.offsetWidth ?? 0;
			if (left > 0 && input.style.paddingLeft !== `${left}px`) input.style.paddingLeft = `${left}px`;
			if (right > 0 && input.style.paddingRight !== `${right}px`) input.style.paddingRight = `${right}px`;
		};
		const observer = new ResizeObserver(update);
		if (prefix) observer.observe(prefix, { box: "border-box" });
		if (suffix) observer.observe(suffix, { box: "border-box" });
		update();
		onCleanup(() => {
			active = false;
			observer.disconnect();
		});
	}, { immediate: true, flush: "post" });
}
