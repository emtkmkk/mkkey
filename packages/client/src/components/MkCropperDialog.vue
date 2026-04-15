<template>
	<XModalWindow
		ref="dialogEl"
		:width="800"
		:height="500"
		:scroll="false"
		:with-ok-button="true"
		@close="cancel()"
		@ok="ok()"
		@closed="$emit('closed')"
	>
		<template #header>{{ i18n.ts.cropImage }}</template>
		<template #default="{ width, height }">
			<div
				class="mk-cropper-dialog"
				:style="`--vw: ${width ? `${width}px` : '100%'}; --vh: ${
					height ? `${height}px` : '100%'
				};`"
			>
				<Transition name="fade">
					<div v-if="loading" class="loading">
						<MkLoading />
					</div>
				</Transition>
				<div class="container">
					<img
						ref="imgEl"
						:src="imgUrl"
						style="display: none"
						@load="onImageLoad"
					/>
				</div>
			</div>
		</template>
	</XModalWindow>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 画像トリミング用モーダルダイアログ。
 * 指定アスペクト比でクロップ範囲を選択し、OK でクロップ済み画像を Drive にアップロードして返す。
 *
 * @remarks
 * 初期選択は「表示中の画像領域いっぱい」または「指定 aspectRatio で収まる最大矩形」に設定し、
 * 枠に対して極端に小さく・変な位置になる事象を防いでいる。
 *
 * @public
 */
import { onBeforeUnmount, onMounted } from "vue";
import * as misskey from "calckey-js";
import Cropper from "cropperjs";
import type { CropperCanvas, CropperImage, CropperSelection } from "cropperjs";
import tinycolor from "tinycolor2";
import XModalWindow from "@/components/MkModalWindow.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import { apiUrl, url } from "@/config";
import { mergeMkkeyApiClientHeaders } from "@/scripts/mkkey-api-client-headers";
import { query } from "@/scripts/url";
import { i18n } from "@/i18n";

/** キャンバス内での画像表示領域（オフセット＋幅高さ） */
type SelectionBounds = {
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
};

/** 選択範囲のスナップショット（x, y, width, height） */
type SelectionSnapshot = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** 選択変更イベントの detail の型 */
type CropperSelectionData = Partial<SelectionSnapshot> | null | undefined;

/** 画像 transform イベントの detail（contain 判定用） */
type CropperImageTransformDetail = { matrix?: number[] };

const MIN_SELECTION_SIZE = 0.001;

const emit = defineEmits<{
	(ev: "ok", cropped: misskey.entities.DriveFile): void;
	(ev: "cancel"): void;
	(ev: "closed"): void;
}>();

const props = defineProps<{
	file: misskey.entities.DriveFile;
	aspectRatio: number;
	uploadFolder?: string | null;
	to?: string | null;
}>();

const imgUrl = `${url}/proxy/image.webp?${query({
	url: props.file.url,
})}`;
let dialogEl = $ref<InstanceType<typeof XModalWindow>>();
let imgEl = $ref<HTMLImageElement>();
let cropper: Cropper | null = null;
let cropperCanvas: CropperCanvas | null = null;
let cropperImage: CropperImage | null = null;
let cropperSelection: CropperSelection | null = null;
let loading = $ref(true);

/** contain 強制の requestAnimationFrame ID。@internal */
let containEnforcementFrame: number | null = null;
/** contain 強制を一時的に止めるフラグ（初期選択設定時など）。@internal */
let suppressContainEnforcement = false;
let selectionChangeListener: ((event: Event) => void) | null = null;
let imageTransformListener: ((event: Event) => void) | null = null;
let canvasActionEndListener: (() => void) | null = null;

/** 数値の clamp。@internal */
function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

// #region 表示領域（bounds）取得と初期選択の計算

/**
 * キャンバス上での画像の表示領域を取得する。
 * 画像がまだない／サイズ 0 の場合は null を返す。
 *
 * @param c - Cropper インスタンス
 * @returns 表示矩形（offsetX, offsetY, width, height）または null
 * @internal
 */
function getSelectionBounds(c: Cropper): SelectionBounds | null {
	const canvas = c.getCropperCanvas();
	const image = c.getCropperImage();
	if (!canvas) return null;
	const canvasRect = canvas.getBoundingClientRect();
	if (!canvasRect.width || !canvasRect.height) return null;
	const imageRect = image?.getBoundingClientRect();
	if (
		imageRect &&
		imageRect.width > 0 &&
		imageRect.height > 0
	) {
		return {
			offsetX: Math.round(imageRect.left - canvasRect.left),
			offsetY: Math.round(imageRect.top - canvasRect.top),
			width: Math.round(imageRect.width),
			height: Math.round(imageRect.height),
		};
	}
	return {
		offsetX: 0,
		offsetY: 0,
		width: Math.round(canvasRect.width),
		height: Math.round(canvasRect.height),
	};
}

/**
 * bounds に収まる初期選択の (x, y, width, height) を計算する。
 * aspectRatio === 0 のときは bounds 全体、それ以外は指定比で最大の矩形を中央に配置する。
 *
 * @param bounds - 表示領域
 * @param aspectRatio - 0 で自由比、正の数で幅/高さの比
 * @returns { x, y, width, height }
 * @internal
 */
function computeInitialSelection(
	bounds: SelectionBounds,
	aspectRatio: number,
): { x: number; y: number; width: number; height: number } {
	if (aspectRatio <= 0) {
		return {
			x: bounds.offsetX,
			y: bounds.offsetY,
			width: bounds.width,
			height: bounds.height,
		};
	}
	// 指定アスペクト比で bounds に収まる最大矩形（中央寄せ）
	const ratio = aspectRatio;
	let width: number;
	let height: number;
	if (bounds.width / bounds.height <= ratio) {
		width = bounds.width;
		height = bounds.width / ratio;
	} else {
		height = bounds.height;
		width = bounds.height * ratio;
	}
	const x = bounds.offsetX + (bounds.width - width) / 2;
	const y = bounds.offsetY + (bounds.height - height) / 2;
	return { x, y, width, height };
}

// #endregion

// #region contain 強制・選択のクランプ・イベント処理（アイコンジェネレーターと同様）

/**
 * 画像を常に contain で収めるため、requestAnimationFrame で $center("contain") を継続する。
 * @internal
 */
function ensureContainEnforcement(): void {
	if (containEnforcementFrame != null) return;
	const step = () => {
		if (!cropperImage) {
			containEnforcementFrame = null;
			return;
		}
		if (!suppressContainEnforcement) {
			try {
				cropperImage.$center("contain");
			} catch {
				// noop - 予期しないランタイムエラーを防ぐ
			}
		}
		containEnforcementFrame = window.requestAnimationFrame(step);
	};
	containEnforcementFrame = window.requestAnimationFrame(step);
}

/** contain 強制のループを停止する。@internal */
function cancelContainEnforcement(): void {
	if (containEnforcementFrame != null) {
		window.cancelAnimationFrame(containEnforcementFrame);
		containEnforcementFrame = null;
	}
}

/**
 * contain 強制を一時的に止めて callback を実行し、終了後に再開する。
 * 初期選択の $change などでレイアウトがぶれないようにする。
 * @internal
 */
function runWithContainSuppressed(callback: () => void): void {
	const previous = suppressContainEnforcement;
	suppressContainEnforcement = true;
	try {
		callback();
	} finally {
		suppressContainEnforcement = previous;
		if (!previous) ensureContainEnforcement();
	}
}

/**
 * 指定 transform を適用した場合に画像がキャンバスからはみ出すか判定する。
 * はみ出す場合は true を返し、呼び出し側で event.preventDefault() する想定。
 * @internal
 */
function shouldPreventContainTransform(matrix: number[]): boolean {
	if (!cropperCanvas || !cropperImage) return false;
	const canvasRect = cropperCanvas.getBoundingClientRect();
	if (!canvasRect.width || !canvasRect.height) return false;
	const clone = cropperImage.cloneNode() as CropperImage;
	clone.style.transform = `matrix(${matrix.join(", ")})`;
	clone.style.opacity = "0";
	cropperCanvas.appendChild(clone);
	const imageRect = clone.getBoundingClientRect();
	cropperCanvas.removeChild(clone);
	if (!imageRect.width || !imageRect.height) return false;
	return (
		(imageRect.top > canvasRect.top && imageRect.right < canvasRect.right) ||
		(imageRect.right < canvasRect.right && imageRect.bottom < canvasRect.bottom) ||
		(imageRect.bottom < canvasRect.bottom && imageRect.left > canvasRect.left) ||
		(imageRect.left > canvasRect.left && imageRect.top > canvasRect.top)
	);
}

/**
 * 選択範囲を表示領域（bounds）内にクランプする。
 * aspectRatio 0 は自由比、正の数は幅/高さの比を維持する。
 * @internal
 */
function clampSelectionSnapshot(snapshot: SelectionSnapshot): SelectionSnapshot {
	const bounds = cropper ? getSelectionBounds(cropper) : null;
	if (!bounds) return { ...snapshot };
	const ratio = props.aspectRatio;

	if (ratio <= 0) {
		const minW = MIN_SELECTION_SIZE;
		const minH = MIN_SELECTION_SIZE;
		const width = clamp(
			Number.isFinite(snapshot.width) ? snapshot.width : bounds.width,
			minW,
			bounds.width,
		);
		const height = clamp(
			Number.isFinite(snapshot.height) ? snapshot.height : bounds.height,
			minH,
			bounds.height,
		);
		const maxX = bounds.offsetX + Math.max(0, bounds.width - width);
		const maxY = bounds.offsetY + Math.max(0, bounds.height - height);
		const x = clamp(
			Number.isFinite(snapshot.x) ? snapshot.x : bounds.offsetX,
			bounds.offsetX,
			maxX,
		);
		const y = clamp(
			Number.isFinite(snapshot.y) ? snapshot.y : bounds.offsetY,
			bounds.offsetY,
			maxY,
		);
		return { x, y, width, height };
	}

	const maxWidth = Math.min(bounds.width, bounds.height * ratio);
	const maxHeight = Math.min(bounds.height, bounds.width / ratio);
	let width = clamp(
		Number.isFinite(snapshot.width) ? snapshot.width : maxWidth,
		MIN_SELECTION_SIZE,
		maxWidth,
	);
	let height = width / ratio;
	if (height > bounds.height) {
		height = bounds.height;
		width = height * ratio;
	}
	const maxX = bounds.offsetX + Math.max(0, bounds.width - width);
	const maxY = bounds.offsetY + Math.max(0, bounds.height - height);
	const x = clamp(
		Number.isFinite(snapshot.x) ? snapshot.x : bounds.offsetX,
		bounds.offsetX,
		maxX,
	);
	const y = clamp(
		Number.isFinite(snapshot.y) ? snapshot.y : bounds.offsetY,
		bounds.offsetY,
		maxY,
	);
	return { x, y, width, height };
}

function isNearlyEqual(a: number, b: number, epsilon = 0.001): boolean {
	return Math.abs(a - b) <= epsilon;
}

function isSameSelection(a: SelectionSnapshot, b: SelectionSnapshot): boolean {
	return (
		isNearlyEqual(a.x, b.x) &&
		isNearlyEqual(a.y, b.y) &&
		isNearlyEqual(a.width, b.width) &&
		isNearlyEqual(a.height, b.height)
	);
}

function toSelectionSnapshot(source: CropperSelectionData | SelectionSnapshot): SelectionSnapshot | null {
	if (!source) return null;
	const { x, y, width, height } = source;
	if (x == null || y == null || width == null || height == null) return null;
	const widthValue = Number(width);
	const heightValue = Number(height);
	const sizeSource = Math.max(
		Number.isFinite(widthValue) ? widthValue : 0,
		Number.isFinite(heightValue) ? heightValue : 0,
	);
	const size = Math.max(MIN_SELECTION_SIZE, sizeSource);
	const w = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : size;
	const h = Number.isFinite(heightValue) && heightValue > 0 ? heightValue : size;
	return {
		x: Number(x) || 0,
		y: Number(y) || 0,
		width: w,
		height: h,
	};
}

/**
 * 選択変更時に bounds 内にクランプし、必要なら selection.$change で反映する。
 * アイコンジェネレーターの handleSelectionChange と同様の役割（履歴なし）。
 * @internal
 */
function handleSelectionChange(recordEnd: boolean, source?: CropperSelectionData | SelectionSnapshot): void {
	const rawSnapshot = toSelectionSnapshot(
		source ??
			(cropperSelection
				? {
						x: cropperSelection.x,
						y: cropperSelection.y,
						width: cropperSelection.width,
						height: cropperSelection.height,
					}
				: undefined),
	);
	if (!rawSnapshot || !cropperSelection) return;
	const clamped = clampSelectionSnapshot(rawSnapshot);
	if (!isSameSelection(rawSnapshot, clamped)) {
		cropperSelection.$change(
			clamped.x,
			clamped.y,
			clamped.width,
			clamped.height,
			props.aspectRatio > 0 ? props.aspectRatio : undefined,
		);
	}
	updateHandleSizes(clamped.width, clamped.height);
}

type CropperHandleElement = HTMLElement & { action?: string };

function setHandleAction(element: Element | null | undefined, action: string): void {
	const handle = element as CropperHandleElement | null;
	if (!handle) return;
	if (typeof handle.action !== "undefined") handle.action = action;
	handle.setAttribute("action", action);
}

/** ノブの最大・最小サイズと辺ノブを非表示にする閾値。@internal */
const HANDLE_MAX = 32;
const HANDLE_MIN = 15;
const EDGE_HIDE_THRESHOLD = 64;

/**
 * 選択領域のサイズに応じてノブのサイズと辺ノブの表示を更新する。
 * CSS 変数 --handle-size, --handle-offset, --edge-display を cropperSelection に設定し、
 * ハンドルのスタイルが自動で追従する。
 *
 * @param selectionWidth - 選択領域の幅（px）
 * @param selectionHeight - 選択領域の高さ（px）
 * @internal
 */
function updateHandleSizes(selectionWidth: number, selectionHeight: number): void {
	if (!cropperSelection) return;
	const minDim = Math.min(selectionWidth, selectionHeight);
	const size = Math.max(HANDLE_MIN, Math.min(HANDLE_MAX, Math.floor(minDim / 3)));
	const offset = Math.round(size / 2);
	const hideEdges = minDim < EDGE_HIDE_THRESHOLD;

	cropperSelection.style.setProperty("--handle-size", `${size}px`);
	cropperSelection.style.setProperty("--handle-offset", `-${offset}px`);
	cropperSelection.style.setProperty("--edge-display", hideEdges ? "none" : "block");
}

/**
 * リサイズ用ハンドルの Shadow DOM に ::after のサイズを CSS 変数参照で注入する。
 * @internal
 */
function injectCropperHandleStyles(container: Element): void {
	const handles = container.querySelectorAll<HTMLElement>('cropper-handle[action$="-resize"]');
	const styleContent = `:host::after{width:var(--handle-size,${HANDLE_MAX}px)!important;height:var(--handle-size,${HANDLE_MAX}px)!important;left:50%;top:50%;transform:translate(-50%,-50%)}@media(pointer:coarse){:host::after{width:var(--handle-size,${HANDLE_MAX}px)!important;height:var(--handle-size,${HANDLE_MAX}px)!important}}`;
	handles.forEach((el) => {
		if (el.shadowRoot) {
			const style = document.createElement("style");
			style.textContent = styleContent;
			el.shadowRoot.appendChild(style);
		}
	});
}

// #endregion

// #region 初期選択の適用

/**
 * 画像を contain で中央に配置し、初期選択を表示領域いっぱい（または指定比で最大）に設定する。
 * モーダル表示直後とアニメーション後の両方で呼ぶ想定。
 * アイコンジェネレーターと同様に runWithContainSuppressed 内で画像配置し、クランプしてから $change する。
 *
 * @internal
 */
function initializeSelectionAndImage(): void {
	if (!cropper) return;
	const image = cropper.getCropperImage();
	const selection = cropper.getCropperSelection();
	if (!image || !selection) return;

	runWithContainSuppressed(() => {
		image.$center("contain");
	});
	const bounds = getSelectionBounds(cropper);
	if (bounds && bounds.width > 0 && bounds.height > 0) {
		const raw = computeInitialSelection(bounds, props.aspectRatio);
		const initial = clampSelectionSnapshot(raw);
		selection.$change(
			initial.x,
			initial.y,
			initial.width,
			initial.height,
			props.aspectRatio > 0 ? 1 : undefined,
		);
	}
	selection.$center();
	// 初期状態のノブサイズを設定
	updateHandleSizes(selection.width, selection.height);
	handleSelectionChange(true, {
		x: selection.x,
		y: selection.y,
		width: selection.width,
		height: selection.height,
	});
}

// #endregion

// #region クロップ実行とダイアログ操作

/**
 * 現在の選択範囲でクロップし、Drive にアップロードしてからダイアログを閉じて結果を返す。
 * @internal
 */
const ok = async () => {
        const promise = new Promise<misskey.entities.DriveFile>(async (res, rej) => {
                const croppedImage = await cropper?.getCropperImage();
                const croppedSection = await cropper?.getCropperSelection();
                let failureNotified = false;
                const failed = () => {
                        if (failureNotified) return;
                        failureNotified = true;
                        os.alert({
                                type: "error",
                                text: i18n.ts.somethingHappened,
                        });
                        rej(new Error("failed to crop image"));
                };
                if (!croppedImage || !croppedSection) {
                        failed();
                        return;
                }
                // 拡大率を計算し、(ほぼ)元の大きさに戻す
                const zoomedRate =
                        croppedImage.getBoundingClientRect().width /
                        croppedImage.clientWidth;
                const widthToRender =
                        croppedSection.getBoundingClientRect().width / zoomedRate;
                const croppedCanvas = await croppedSection.$toCanvas({
                        width: widthToRender,
                });
                if (!croppedCanvas) {
                        failed();
                        return;
                }

                const preferredMime = (() => {
                        const extension = props.file.name?.split(".").pop()?.toLowerCase();
                        switch (extension) {
                                case "webp":
                                        return "image/webp";
                                case "png":
                                case "apng":
                                        return "image/png";
                                case "avif":
                                        return "image/avif";
                                default:
                                        return "image/png";
                        }
                })();

                const triedTypes = Array.from(
                        new Set([preferredMime, "image/png"]),
                );
                let blob: Blob | null = null;
                for (const type of triedTypes) {
                        blob = await new Promise<Blob | null>((resolve) => {
                                croppedCanvas.toBlob((canvasBlob) => {
                                        resolve(canvasBlob);
                                }, type);
                        });
                        if (blob) break;
                }

                if (!blob) {
                        failed();
                        return;
                }

                const formData = new FormData();
                formData.append("file", blob, `cropped_${props.file.name}`);
                formData.append("name", `cropped_${props.file.name}`);
                formData.append(
                        "isSensitive",
                        props.file.isSensitive ? "true" : "false"
                );
                if (props.file.comment) {
                        formData.append("comment", props.file.comment);
                }

                const folderId = props.uploadFolder
                        ? props.uploadFolder
                        : defaultStore.state.uploadFolderAvatar && props.to === "avatar"
                        ? defaultStore.state.uploadFolderAvatar
                        : defaultStore.state.uploadFolderBanner && props.to === "banner"
                        ? defaultStore.state.uploadFolderBanner
                        : defaultStore.state.uploadFolderEmoji && props.to === "emoji"
                        ? defaultStore.state.uploadFolderEmoji
                        : defaultStore.state.uploadFolder;

                if (folderId) {
                        formData.append("folderId", folderId);
                }

                fetch(`${apiUrl}/drive/files/create`, {
                        method: "POST",
                        body: formData,
                        headers: mergeMkkeyApiClientHeaders({
                                authorization: `Bearer ${$i.token}`,
                        }),
                })
                        .then((response) => response.json())
                        .then((f) => {
                                res(f);
                        })
                        .catch(() => {
                                failed();
                        });
        });

        os.promiseDialog(promise);

        try {
                const f = await promise;

                emit("ok", f);
                dialogEl.close();
        } catch {
                // noop: エラーはすでに通知済み
        }
};

/**
 * キャンセル時: イベントを発火してダイアログを閉じる。
 * @internal
 */
const cancel = () => {
	emit("cancel");
	dialogEl.close();
};

/**
 * 画像読み込み完了時にローディングを解除し、初期選択を表示領域に合わせて適用する。
 * @internal
 */
const onImageLoad = () => {
	loading = false;
	initializeSelectionAndImage();
};

// #endregion

// #region マウントと選択の初期化・破棄

onMounted(() => {
	cropper = new Cropper(imgEl, {});

	const computedStyle = getComputedStyle(document.documentElement);

	const initializeElements = (attempt = 0) => {
		if (!cropper) return;
		const canvas = cropper.getCropperCanvas();
		const image = cropper.getCropperImage();
		const selection = cropper.getCropperSelection();

		if (!canvas || !image || !selection) {
			if (attempt < 60) {
				window.setTimeout(() => initializeElements(attempt + 1), 50);
			}
			return;
		}

		cropperCanvas = canvas;
		cropperCanvas.background = false;
		cropperImage = image;
		cropperImage.translatable = true;
		cropperImage.rotatable = false;
		cropperImage.scalable = true;
		ensureContainEnforcement();
		cropperSelection = selection;

		if (selectionChangeListener) {
			selection.removeEventListener("change", selectionChangeListener as EventListener);
		}
		selectionChangeListener = (event: Event) => {
			const detail = (event as CustomEvent<CropperSelectionData>).detail ?? {
				x: selection.x,
				y: selection.y,
				width: selection.width,
				height: selection.height,
			};
			handleSelectionChange(false, detail);
		};
		selection.addEventListener("change", selectionChangeListener as EventListener);

		if (imageTransformListener) {
			image.removeEventListener("transform", imageTransformListener as EventListener);
		}
		imageTransformListener = (event: Event) => {
			const detail = (event as CustomEvent<CropperImageTransformDetail>).detail;
			const matrix = detail?.matrix;
			if (matrix && shouldPreventContainTransform(matrix)) {
				event.preventDefault();
				return;
			}
			if (!cropperSelection) return;
			handleSelectionChange(false, {
				x: cropperSelection.x,
				y: cropperSelection.y,
				width: cropperSelection.width,
				height: cropperSelection.height,
			});
		};
		image.addEventListener("transform", imageTransformListener as EventListener);

		if (canvasActionEndListener) {
			canvas.removeEventListener("actionend", canvasActionEndListener as EventListener);
		}
		canvasActionEndListener = () => {
			if (!cropperSelection) return;
			handleSelectionChange(true, {
				x: cropperSelection.x,
				y: cropperSelection.y,
				width: cropperSelection.width,
				height: cropperSelection.height,
			});
		};
		canvas.addEventListener("actionend", canvasActionEndListener as EventListener);

		selection.themeColor = tinycolor(
			computedStyle.getPropertyValue("--accent"),
		).toHexString();
		selection.aspectRatio = props.aspectRatio;
		selection.initialAspectRatio = props.aspectRatio;
		if (props.aspectRatio > 0) {
			(selection as { initialCoverage?: number }).initialCoverage = 1;
		}
		selection.movable = true;
		selection.resizable = true;
		selection.keyboard = true;
		selection.outlined = true;
		selection.precise = true;

		setHandleAction(
			canvas.querySelector('cropper-handle[action="select"]'),
			"none",
		);

		injectCropperHandleStyles(canvas);

		const doInitializeSelection = () => {
			if (!cropperSelection || cropperSelection !== selection) return;
			initializeSelectionAndImage();
		};
		window.setTimeout(doInitializeSelection, 50);
		window.setTimeout(doInitializeSelection, 100);
		window.setTimeout(doInitializeSelection, 500);
	};

	initializeElements();
});

onBeforeUnmount(() => {
	cancelContainEnforcement();
	suppressContainEnforcement = false;
	if (cropperSelection && selectionChangeListener) {
		cropperSelection.removeEventListener("change", selectionChangeListener as EventListener);
	}
	if (cropperImage && imageTransformListener) {
		cropperImage.removeEventListener("transform", imageTransformListener as EventListener);
	}
	if (cropperCanvas && canvasActionEndListener) {
		cropperCanvas.removeEventListener("actionend", canvasActionEndListener as EventListener);
	}
	selectionChangeListener = null;
	canvasActionEndListener = null;
	imageTransformListener = null;
	cropperCanvas = null;
	cropperImage = null;
	cropperSelection = null;

	if (cropper && imgEl) {
		const container = cropper.container;
		if (container) {
			let next = imgEl.nextElementSibling;
			while (next && (next as Element).tagName?.startsWith("CROPPER-")) {
				const current = next;
				next = next.nextElementSibling;
				(current as Element).remove();
			}
		}
	}
	cropper = null;
});

// #endregion
</script>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.5s ease 0.5s;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

.mk-cropper-dialog {
	display: flex;
	flex-direction: column;
	width: var(--vw);
	height: var(--vh);
	position: relative;

	> .loading {
		position: absolute;
		z-index: 10;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		-webkit-backdrop-filter: var(--blur, blur(10px));
		backdrop-filter: var(--blur, blur(10px));
		background: rgba(0, 0, 0, 0.5);
	}

	> .container {
		flex: 1;
		width: 100%;
		height: 100%;
		display: flex; /* margin: auto の縦方向を有効にする */

		> ::v-deep(cropper-canvas) {
			width: calc(100% - 32px);
			height: calc(100% - 32px);
			margin: auto;
			overflow: visible !important;

			> cropper-selection > cropper-handle[action="move"] {
				background: transparent;
			}

			/* 上下辺: 幅100%（辺全体を掴んでリサイズ可能）、高さは CSS 変数で動的 */
			> cropper-selection > cropper-handle[action="n-resize"] {
				height: var(--handle-size, 32px);
				min-height: var(--handle-size, 32px);
				top: var(--handle-offset, -16px);
				display: var(--edge-display, block);
			}
			> cropper-selection > cropper-handle[action="s-resize"] {
				height: var(--handle-size, 32px);
				min-height: var(--handle-size, 32px);
				bottom: var(--handle-offset, -16px);
				display: var(--edge-display, block);
			}
			/* 左右辺: 高さ100%（辺全体を掴んでリサイズ可能）、幅は CSS 変数で動的 */
			> cropper-selection > cropper-handle[action="e-resize"] {
				width: var(--handle-size, 32px);
				min-width: var(--handle-size, 32px);
				right: var(--handle-offset, -16px);
				display: var(--edge-display, block);
			}
			> cropper-selection > cropper-handle[action="w-resize"] {
				width: var(--handle-size, 32px);
				min-width: var(--handle-size, 32px);
				left: var(--handle-offset, -16px);
				display: var(--edge-display, block);
			}
			/* 四隅: CSS 変数で動的サイズ、常に表示 */
			> cropper-selection > cropper-handle[action="ne-resize"] {
				width: var(--handle-size, 32px);
				height: var(--handle-size, 32px);
				min-width: var(--handle-size, 32px);
				min-height: var(--handle-size, 32px);
				top: var(--handle-offset, -16px);
				right: var(--handle-offset, -16px);
			}
			> cropper-selection > cropper-handle[action="nw-resize"] {
				width: var(--handle-size, 32px);
				height: var(--handle-size, 32px);
				min-width: var(--handle-size, 32px);
				min-height: var(--handle-size, 32px);
				top: var(--handle-offset, -16px);
				left: var(--handle-offset, -16px);
			}
			> cropper-selection > cropper-handle[action="se-resize"] {
				width: var(--handle-size, 32px);
				height: var(--handle-size, 32px);
				min-width: var(--handle-size, 32px);
				min-height: var(--handle-size, 32px);
				bottom: var(--handle-offset, -16px);
				right: var(--handle-offset, -16px);
			}
			> cropper-selection > cropper-handle[action="sw-resize"] {
				width: var(--handle-size, 32px);
				height: var(--handle-size, 32px);
				min-width: var(--handle-size, 32px);
				min-height: var(--handle-size, 32px);
				bottom: var(--handle-offset, -16px);
				left: var(--handle-offset, -16px);
			}
		}
	}
}
</style>
