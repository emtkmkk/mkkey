/**
 * @packageDocumentation
 *
 * リアクション用の絵文字ピッカーを管理するモジュール。
 *
 * @remarks
 * 低速回線時の初回ロード失敗から復帰しやすくするため、表示時に都度 popup を生成する。
 * 起動時はアイドル時間にチャンクを軽く先読みするのみで、失敗しても致命扱いにはしない。
 *
 * @public
 */

import { defineAsyncComponent } from "vue";
import { popup } from "@/os";

type PopupHandle = Awaited<ReturnType<typeof popup>>;

/**
 * リアクション絵文字ピッカーの表示ライフサイクル管理クラス。
 *
 * @remarks
 * 初期化時はチャンクを先読みするだけに留め、実際の表示は `show()` 呼び出しごとに popup を新規生成する。
 * これにより、低速回線で先読みが失敗した場合でも次回表示時に再試行できる。
 *
 * @public
 */
class ReactionPicker {
	//#region フィールド
	private onChosen?: (reaction: string) => void;
	private onClosed?: () => void;
	private openingPicker: PopupHandle | null = null;
	private isOpening = false;
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
		// NOTE: 起動直後のネットワーク輻輳を避けるため、先読みはアイドル時に遅延実行する。
		const preload = () => {
			void import("@/components/MkEmojiPickerDialog.vue").catch(() => {
				// NOTE: 先読み失敗は許容する。表示時に都度再試行できる設計にしている。
			});
		};
		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			(window as Window & {
				requestIdleCallback: (callback: IdleRequestCallback) => number;
			}).requestIdleCallback(() => preload());
		} else {
			globalThis.setTimeout(preload, 500);
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
		// NOTE: 二重オープンを防ぐ。既に開いている場合は新規表示しない。
		if (this.openingPicker || this.isOpening) return;

		this.onChosen = onChosen;
		this.onClosed = onClosed;
		this.isOpening = true;

		void popup(
			defineAsyncComponent(() => import("@/components/MkEmojiPickerDialog.vue")),
			{
				src,
				asReactionPicker: true,
			},
			{
				done: (reaction) => {
					this.onChosen?.(reaction);
				},
				closed: () => {
					this.openingPicker?.dispose();
					this.openingPicker = null;
					this.isOpening = false;
					this.onClosed?.();
				},
			},
		)
			.then((picker) => {
				this.openingPicker = picker;
				this.isOpening = false;
			})
			.catch(() => {
				this.openingPicker = null;
				this.isOpening = false;
				this.onClosed?.();
			});
	}
	//#endregion
}

export const reactionPicker = new ReactionPicker();
