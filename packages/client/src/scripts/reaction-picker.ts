/**
 * @packageDocumentation
 *
 * リアクション用の絵文字ピッカーを管理するモジュール。
 *
 * @remarks
 * TLスクロール位置への副作用を抑えるため、ピッカーは常駐させて `manualShowing` で開閉する。
 * 低速回線時でも復帰しやすいよう、非同期コンポーネントに再試行ロジックを持たせる。
 *
 * @public
 */

import { defineAsyncComponent, ref, type Component } from "vue";
import { popup } from "@/os";

type PopupHandle = Awaited<ReturnType<typeof popup>>;

/**
 * リアクション絵文字ピッカーの表示ライフサイクル管理クラス。
 *
 * @remarks
 * 初期化時に popup を1度だけ作成し、表示時はアンカー更新と `manualShowing` 切り替えで開く。
 * ロード失敗時は再試行付きローダーと再初期化で復帰できるようにする。
 *
 * @public
 */
class ReactionPicker {
	//#region フィールド
	private src = ref<HTMLElement | null>(null);
	private manualShowing = ref(false);
	private onChosen?: (reaction: string) => void;
	private onClosed?: () => void;
	private popupHandle: PopupHandle | null = null;
	private isInitializing = false;
	private hasLoadError = false;
	//#endregion

	//#region 公開メソッド
	constructor() {
		// nop
	}

	/**
	 * リアクション絵文字ピッカーの先読みを遅延実行する。
	 *
	 * @remarks
	 * 起動時の通信混雑を避けるためアイドル時間に先読みする。
	 * 先読み失敗は許容し、表示時の再試行に任せる。
	 *
	 * @returns 初期化処理の完了を返す。
	 * @public
	 */
	public async init() {
		if (this.popupHandle || this.isInitializing) return;
		this.isInitializing = true;

		// NOTE: 先に軽い先読みだけ仕掛けておき、起動直後の輻輳を避ける。
		this.schedulePreload();

		try {
			this.popupHandle = await popup(
				this.createPickerComponent(),
				{
					src: this.src,
					asReactionPicker: true,
					manualShowing: this.manualShowing,
				},
				{
					done: (reaction) => {
						this.onChosen?.(reaction);
					},
					close: () => {
						this.manualShowing.value = false;
					},
					closed: () => {
						this.src.value = null;
						this.onClosed?.();
					},
				},
			);
		} finally {
			this.isInitializing = false;
		}
	}

	/**
	 * リアクション絵文字ピッカーを表示する。
	 *
	 * @param src - ピッカー位置合わせに使うアンカー要素
	 * @param onChosen - 絵文字選択時のコールバック
	 * @param onClosed - ピッカー終了時のコールバック
	 * @returns なし
	 *
	 * @remarks
	 * 既に開いている場合は二重起動を防ぐため何もしない。
	 * 表示に失敗した場合でも状態をリセットして次回再試行できるようにする。
	 *
	 * @public
	 */
	public show(
		src: HTMLElement,
		onChosen: ReactionPicker["onChosen"],
		onClosed: ReactionPicker["onClosed"],
	) {
		this.onChosen = onChosen;
		this.onClosed = onClosed;
		void this.showInternal(src);
	}
	//#endregion

	//#region 非公開ヘルパー
	/**
	 * ピッカー表示の内部処理。
	 *
	 * @param src - ピッカーのアンカー要素
	 * @returns 完了まで待機する Promise
	 * @internal
	 */
	private async showInternal(src: HTMLElement): Promise<void> {
		// NOTE: 既に表示中なら多重起動しない。
		if (this.manualShowing.value) return;

		if (!src?.isConnected) return;

		// NOTE: ロード失敗状態を検出した場合は popup 自体を作り直して復帰を試みる。
		if (this.hasLoadError && this.popupHandle) {
			this.popupHandle.dispose();
			this.popupHandle = null;
			this.hasLoadError = false;
		}

		if (!this.popupHandle) {
			await this.init();
		}
		if (!this.popupHandle || !src.isConnected) return;

		this.src.value = src;
		this.manualShowing.value = true;
	}

	/**
	 * リアクションピッカーの遅延先読みを行う。
	 *
	 * @remarks
	 * NOTE: 先読みは任意処理なので失敗しても握りつぶす。
	 *
	 * @returns なし
	 * @internal
	 */
	private schedulePreload(): void {
		const preload = () => {
			void import("@/components/MkEmojiPickerDialog.vue").catch(() => {
				// NOTE: 失敗時は表示タイミングでの再試行に任せる。
			});
		};
		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			(window as Window & {
				requestIdleCallback: (callback: IdleRequestCallback) => number;
			}).requestIdleCallback(() => preload());
			return;
		}
		globalThis.setTimeout(preload, 500);
	}

	/**
	 * 再試行付きの非同期コンポーネントを生成する。
	 *
	 * @returns `MkEmojiPickerDialog` の非同期コンポーネント
	 * @internal
	 */
	private createPickerComponent(): Component {
		return defineAsyncComponent({
			loader: () => import("@/components/MkEmojiPickerDialog.vue"),
			delay: 0,
			timeout: 20_000,
			onError: (error, retry, fail, attempts) => {
				// NOTE: 低速回線向けに指数バックオフで再試行する。
				if (attempts <= 3) {
					globalThis.setTimeout(() => retry(), 300 * (2 ** (attempts - 1)));
					return;
				}
				this.hasLoadError = true;
				fail();
			},
		});
	}
	//#endregion
}

export const reactionPicker = new ReactionPicker();
