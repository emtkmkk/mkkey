/**
 * @packageDocumentation
 *
 * 画面幅・デバイス種別から「モバイルUIを使うべきか」を返す共有リアクティブ値。
 *
 * @remarks
 * 各ページ・コンポーネントが個別に `window.addEventListener("resize", ...)` を
 * 登録すると、unmount時に解除されずリスナーが増え続けてしまう。
 * モジュール単位でシングルトンの resize リスナーを 1 本だけ持ち、
 * 全ての呼び出し元で同じ `Ref<boolean>` を共有する。
 *
 * @public
 */
import { ref } from "vue";
import { deviceKind } from "@/scripts/device-kind";

const MOBILE_THRESHOLD = 500;

function computeIsMobile(): boolean {
	// デスクトップでウィンドウを狭くしたときモバイルUIが表示されて欲しいことはあるので
	// deviceKind === 'desktop' の判定は行わない
	return deviceKind === "smartphone" || window.innerWidth <= MOBILE_THRESHOLD;
}

const isMobileRef = ref(computeIsMobile());

window.addEventListener("resize", () => {
	isMobileRef.value = computeIsMobile();
});

/**
 * モバイルUIを使うべきかを表す共有 `Ref<boolean>` を返す。
 *
 * @returns 全呼び出し元で共有される reactive な真偽値
 * @public
 */
export function useIsMobile() {
	return isMobileRef;
}
