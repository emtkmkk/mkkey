/**
 * @packageDocumentation
 *
 * 動画を全画面表示にしたとき、動画の縦横に合わせて画面の向きを固定する。
 *
 * @remarks
 * - 横長の動画は横向き、縦長の動画は縦向きに固定する（正方形は何もしない）。
 *   端末の自動回転がオフでも、全画面の間だけ動画に合った向きで見られる。全画面を抜けたら固定を外す。
 * - 使うのは Screen Orientation API の `screen.orientation.lock()`。
 *   Android の Chrome など、全画面表示中にだけ向きを固定できるブラウザで効く。
 * - NOTE: iPhone / iPad の Safari は向きの固定に対応していない（全画面は OS の動画プレーヤーになり、端末の向きに従う）。
 *   対応していないブラウザや、全画面でないときに呼んだ場合、`lock()` は失敗する。
 *   これは「向きを固定できない環境」というだけで不具合ではないので、失敗しても何もしない。
 * - Plyr の内部には依存せず、`fullscreenchange` で「自分の動画を含む要素が全画面になったか」を見る。
 *
 * @public
 */

/** 向きの固定に使う範囲（ブラウザの型定義に `lock` が無いことがあるので最小限で持つ） */
type LockableOrientation = ScreenOrientation & {
	lock?: (orientation: "landscape" | "portrait") => Promise<void>;
};

/**
 * 動画の縦横から、固定する向きを決める
 *
 * @param video - 動画要素
 * @param fallbackSize - 動画の情報がまだ読めていないときに使う縦横（ドライブのファイル情報など）
 * @returns 固定する向き。正方形・不明なら null
 */
function decideOrientation(
	video: HTMLVideoElement,
	fallbackSize?: { width?: number; height?: number },
): "landscape" | "portrait" | null {
	const width = video.videoWidth || fallbackSize?.width || 0;
	const height = video.videoHeight || fallbackSize?.height || 0;
	if (width === 0 || height === 0 || width === height) return null;
	return width > height ? "landscape" : "portrait";
}

/**
 * 動画が全画面になったら、動画の縦横に合わせて画面の向きを固定するよう監視する
 *
 * @remarks
 * 全画面を抜けたとき、または返した関数で監視をやめたときに固定を外す。
 *
 * @param getVideo - 監視する動画要素を返す関数（まだ無ければ null）
 * @param fallbackSize - 動画の情報がまだ読めていないときに使う縦横
 * @returns 監視をやめる関数（コンポーネントを外すときに呼ぶ）
 *
 * @example
 * ```ts
 * const stop = watchVideoFullscreenOrientation(() => videoEl.value, props.video.properties);
 * onBeforeUnmount(stop);
 * ```
 *
 * @public
 */
export function watchVideoFullscreenOrientation(
	getVideo: () => HTMLVideoElement | null | undefined,
	fallbackSize?: { width?: number; height?: number },
): () => void {
	/** この動画のために向きを固定しているか */
	let locked = false;

	const unlock = () => {
		if (!locked) return;
		locked = false;
		try {
			screen.orientation?.unlock();
		} catch {
			// 固定を外せない環境では、そもそも固定もできていないので何もしない
		}
	};

	const onFullscreenChange = () => {
		const fullscreenEl =
			document.fullscreenElement ??
			(document as Document & { webkitFullscreenElement?: Element | null })
				.webkitFullscreenElement ??
			null;
		const video = getVideo();

		// 全画面を抜けた、または別の要素が全画面になった
		if (fullscreenEl == null || video == null || !fullscreenEl.contains(video)) {
			unlock();
			return;
		}

		const orientation = decideOrientation(video, fallbackSize);
		const target = screen.orientation as LockableOrientation | undefined;
		if (orientation == null || typeof target?.lock !== "function") return;

		target
			.lock(orientation)
			.then(() => {
				locked = true;
			})
			.catch(() => {
				// 向きを固定できないブラウザ・状況（上の NOTE 参照）。全画面表示自体はそのまま使える
			});
	};

	document.addEventListener("fullscreenchange", onFullscreenChange);
	document.addEventListener("webkitfullscreenchange", onFullscreenChange);

	return () => {
		document.removeEventListener("fullscreenchange", onFullscreenChange);
		document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
		unlock();
	};
}
