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
import { onMounted } from "vue";
import * as misskey from "calckey-js";
import Cropper from "cropperjs";
import tinycolor from "tinycolor2";
import XModalWindow from "@/components/MkModalWindow.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import { apiUrl, url } from "@/config";
import { query } from "@/scripts/url";
import { i18n } from "@/i18n";

/** キャンバス内での画像表示領域（オフセット＋幅高さ） */
type SelectionBounds = {
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
};

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
let loading = $ref(true);

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

/**
 * 画像を contain で中央に配置し、初期選択を表示領域いっぱい（または指定比で最大）に設定する。
 * モーダル表示直後とアニメーション後の両方で呼ぶ想定。
 *
 * @internal
 */
function initializeSelectionAndImage(): void {
	if (!cropper) return;
	const image = cropper.getCropperImage();
	const selection = cropper.getCropperSelection();
	if (!image || !selection) return;

	image.$center("contain");
	const bounds = getSelectionBounds(cropper);
	if (bounds && bounds.width > 0 && bounds.height > 0) {
		const { x, y, width, height } = computeInitialSelection(
			bounds,
			props.aspectRatio,
		);
		selection.$change(x, y, width, height, 1);
	} else {
		selection.$center();
	}
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
                        headers: {
                                authorization: `Bearer ${$i.token}`,
                        },
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

// #region マウントと選択の初期化

onMounted(() => {
	cropper = new Cropper(imgEl, {});

	const computedStyle = getComputedStyle(document.documentElement);
	const selection = cropper.getCropperSelection()!;
	selection.themeColor = tinycolor(
		computedStyle.getPropertyValue("--accent")
	).toHexString();
	selection.aspectRatio = props.aspectRatio;
	selection.initialAspectRatio = props.aspectRatio;
	selection.outlined = true;

	// レイアウト確定後に初期選択を表示領域いっぱい（または指定比で最大）に設定
	window.setTimeout(initializeSelectionAndImage, 100);

	// モーダルオープンアニメーションが終わったあとで再度調整
	window.setTimeout(initializeSelectionAndImage, 500);
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

		> ::v-deep(cropper-canvas) {
			width: 100%;
			height: 100%;

			> cropper-selection > cropper-handle[action="move"] {
				background: transparent;
			}
		}
	}
}
</style>
