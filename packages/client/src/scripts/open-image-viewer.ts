/**
 * @packageDocumentation
 *
 * 単一 URL の画像を PhotoSwipe で拡大表示するヘルパー。
 *
 * @remarks
 * アバターや壁紙プレビューなど、{@link MkMediaList} 外の画像向け。
 * 読込・初期化失敗は {@link appendErrorLog} に残す。
 * 開いている間はブラウザやスマホの「戻る」で画像だけを閉じる（{@link bindLightboxCloseOnBack}）。
 *
 * @public
 */
import { appendErrorLog } from "@/os";
import { bindLightboxCloseOnBack } from "@/scripts/close-on-back";

/**
 * 指定 URL の画像を PhotoSwipe で開く。
 *
 * @param targetUrl - 表示する画像の URL
 * @returns ビューア起動完了（失敗時は reject しつつ errorLog にも記録）
 * @throws 画像の読込または lightbox 初期化に失敗した場合
 * @public
 */
export async function openImageViewer(targetUrl: string): Promise<void> {
	try {
		await import("photoswipe/style.css");
		const [pswp, pswpLightbox] = await Promise.all([
			import("photoswipe"),
			import("photoswipe/lightbox"),
		]);

		await new Promise<void>((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				try {
					const lightbox = new pswpLightbox.default({
						dataSource: [
							{
								src: targetUrl,
								w: img.naturalWidth,
								h: img.naturalHeight,
							},
						],
						pswpModule: pswp.default,
						loop: false,
						padding:
							window.innerWidth > 500
								? { top: 32, bottom: 32, left: 32, right: 32 }
								: { top: 0, bottom: 0, left: 0, right: 0 },
					});
					// 「戻る」で画像だけ閉じる。destroy より先に登録し、close で履歴を取り除けるようにする
					bindLightboxCloseOnBack(lightbox);
					lightbox.on("close", () => lightbox.destroy());
					lightbox.init();
					lightbox.loadAndOpen(0);
					resolve();
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			};
			img.onerror = () =>
				reject(new Error("Failed to load image viewer target."));
			img.src = targetUrl;
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		void appendErrorLog(
			`ImageViewer: ${error.message} url=${targetUrl}${
				error.stack ? ` stack:${error.stack}` : ""
			}`,
		);
		throw error;
	}
}
