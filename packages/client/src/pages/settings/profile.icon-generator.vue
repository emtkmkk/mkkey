<template>
        <div class="icon-generator _formRoot">
                <div class="header">
                        <MkButton inline @click="goBack">
                                <i class="ph-arrow-left ph-bold ph-lg"></i>
                                {{ i18n.ts.back }}
                        </MkButton>
                        <div class="spacer"></div>
                        <MkButton inline :disabled="saving" @click="pickImage">
                                <i class="ph-image ph-bold ph-lg"></i>
                                {{
                                        selectedFile
                                                ? i18n.ts._profile.replaceImage
                                                : i18n.ts._profile.selectImage
                                }}
                        </MkButton>
                        <MkButton
                                inline
                                primary
                                :disabled="!selectedFile || saving"
                                @click="save"
                        >
                                {{ saving ? i18n.ts.processing : i18n.ts.save }}
                        </MkButton>
                </div>
                <p class="description">{{ i18n.ts._profile.iconGeneratorDescription }}</p>
                <div class="content">
                        <div class="cropper-panel">
                                <div v-if="!selectedFile" class="empty">
                                        <i class="ph-user-circle-plus ph-bold"></i>
                                        <p>{{ i18n.ts._profile.iconGeneratorEmpty }}</p>
                                        <MkButton primary @click="pickImage">
                                                {{ i18n.ts._profile.selectImage }}
                                        </MkButton>
                                </div>
                                <div v-else class="cropper-wrapper">
                                        <Transition name="fade">
                                                <div v-if="loading" class="loading">
                                                        <MkLoading />
                                                </div>
                                        </Transition>
                                        <div class="cropper-container">
                                                <img
                                                        v-if="imgUrl"
                                                        ref="imgEl"
                                                        :src="imgUrl"
                                                        style="display: none"
                                                        @load="onImageLoad"
                                                />
                                        </div>
                                </div>
                        </div>
                        <div v-if="selectedFile" class="preview-panel">
                                <h2>{{ i18n.ts.preview }}</h2>
                                <p class="hint">
                                        {{ i18n.ts._profile.iconGeneratorPreviewNote }}
                                </p>
                                <div class="preview-list">
                                        <div
                                                v-for="size in previewSizes"
                                                :key="size"
                                                class="preview-row"
                                        >
                                                <div class="preview-label">
                                                        {{ size }}×{{ size }}
                                                </div>
                                                <div class="preview-boxes">
                                                        <div class="preview-box">
                                                                <div
                                                                        class="preview-image square"
                                                                        :style="{ '--preview-size': size + 'px' }"
                                                                >
                                                                        <img
                                                                                v-if="previewSources[size]"
                                                                                :src="previewSources[size]"
                                                                                alt=""
                                                                        />
                                                                        <span v-else>{{ i18n.ts.notSet }}</span>
                                                                </div>
                                                                <span class="preview-caption">
                                                                        {{ i18n.ts._profile.previewSquare }}
                                                                </span>
                                                        </div>
                                                        <div class="preview-box">
                                                                <div
                                                                        class="preview-image circle"
                                                                        :style="{ '--preview-size': size + 'px' }"
                                                                >
                                                                        <img
                                                                                v-if="previewSources[size]"
                                                                                :src="previewSources[size]"
                                                                                alt=""
                                                                        />
                                                                        <span v-else>{{ i18n.ts.notSet }}</span>
                                                                </div>
                                                                <span class="preview-caption">
                                                                        {{ i18n.ts._profile.previewCircle }}
                                                                </span>
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        </div>
                </div>
        </div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, reactive } from "vue";
import Cropper from "cropperjs";
import tinycolor from "tinycolor2";
import type { DriveFile } from "calckey-js/built/entities";
import MkButton from "@/components/MkButton.vue";
import { selectFile } from "@/scripts/select-file";
import { i18n } from "@/i18n";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { url, apiUrl } from "@/config";
import { query } from "@/scripts/url";
import { defaultStore } from "@/store";
import * as os from "@/os";
import { $i } from "@/account";

const router = useRouter();

const previewSizes = [184, 64, 32] as const;
const previewSources = reactive<Record<number, string | null>>({
        184: null,
        64: null,
        32: null,
});

let selectedFile = $ref<DriveFile | null>(null);
let imgEl = $ref<HTMLImageElement | null>(null);
let cropper: Cropper | null = null;
let cropperSelection: any = null;
let cropperImage: any = null;
let loading = $ref(false);
let saving = $ref(false);
let previewUpdating = false;
let previewPending = false;
let selectionListener: (() => void) | null = null;
let pointerListener: (() => void) | null = null;
let imageListener: (() => void) | null = null;

const imgUrl = $computed(() =>
        selectedFile
                ? `${url}/proxy/image.webp?${query({ url: selectedFile.url })}`
                : null,
);

function resetPreviews() {
        previewSizes.forEach((size) => {
                previewSources[size] = null;
        });
}

function goBack() {
        router.push("/settings/profile");
}

async function pickImage(ev?: Event) {
        try {
                const file = await selectFile(
                        ev?.currentTarget ?? ev?.target ?? undefined,
                        i18n.ts.avatar,
                        undefined,
                        undefined,
                        "avatar",
                );
                selectedFile = file;
                loading = true;
                resetPreviews();
                await nextTick();
                setupCropper();
        } catch (err) {
                // noop
        }
}

function onImageLoad() {
        loading = false;
        cropperImage?.$center?.("contain");
        cropperSelection?.$center?.();
        schedulePreviewUpdate();
}

function setupCropper() {
        if (!imgEl) return;

        destroyCropper();

        cropper = new Cropper(imgEl, {});
        cropperSelection = cropper.getCropperSelection();
        cropperImage = cropper.getCropperImage();

        const computedStyle = getComputedStyle(document.documentElement);
        const accentColor = tinycolor(computedStyle.getPropertyValue("--accent")).toHexString();

        if (cropperSelection) {
                cropperSelection.themeColor = accentColor;
                cropperSelection.aspectRatio = 1;
                cropperSelection.initialAspectRatio = 1;
                cropperSelection.outlined = true;
                selectionListener = () => schedulePreviewUpdate();
                pointerListener = () => schedulePreviewUpdate();
                cropperSelection.addEventListener("change", selectionListener);
                cropperSelection.addEventListener("pointerup", pointerListener);
                cropperSelection.addEventListener("pointermove", pointerListener);
                cropperSelection.addEventListener("wheel", pointerListener);
        }

        if (cropperImage) {
                imageListener = () => schedulePreviewUpdate();
                cropperImage.addEventListener("transform", imageListener);
                cropperImage.addEventListener("wheel", imageListener);
        }

        window.setTimeout(() => {
                cropperImage?.$center?.("contain");
                cropperSelection?.$center?.();
                schedulePreviewUpdate();
        }, 100);
        window.setTimeout(() => {
                cropperImage?.$center?.("contain");
                cropperSelection?.$center?.();
                schedulePreviewUpdate();
        }, 500);
}

function destroyCropper() {
        if (cropperSelection && selectionListener) {
                cropperSelection.removeEventListener("change", selectionListener);
        }
        if (cropperSelection && pointerListener) {
                cropperSelection.removeEventListener("pointerup", pointerListener);
                cropperSelection.removeEventListener("pointermove", pointerListener);
                cropperSelection.removeEventListener("wheel", pointerListener);
        }
        if (cropperImage && imageListener) {
                cropperImage.removeEventListener("transform", imageListener);
                cropperImage.removeEventListener("wheel", imageListener);
        }
        if ((cropper as any)?.destroy) {
                (cropper as any).destroy();
        }
        cropper = null;
        cropperSelection = null;
        cropperImage = null;
        selectionListener = null;
        pointerListener = null;
        imageListener = null;
}

function schedulePreviewUpdate() {
        if (!selectedFile || !cropperSelection) return;
        if (previewUpdating) {
                previewPending = true;
                return;
        }
        previewUpdating = true;
        updatePreviews()
                .catch(() => {})
                .finally(() => {
                        previewUpdating = false;
                        if (previewPending) {
                                previewPending = false;
                                schedulePreviewUpdate();
                        }
                });
}

async function updatePreviews() {
        if (!cropperSelection) return;
        const canvases = await Promise.all(
                previewSizes.map((size) => cropperSelection.$toCanvas({
                        width: size,
                        height: size,
                })),
        );
        canvases.forEach((canvas, index) => {
                const size = previewSizes[index];
                previewSources[size] = canvas ? canvas.toDataURL("image/png") : null;
        });
}

async function cropAndUpload(): Promise<DriveFile> {
        if (!selectedFile || !cropperSelection || !cropperImage) {
                throw new Error("cropper is not ready");
        }

        const promise = new Promise<DriveFile>(async (resolve, reject) => {
                const croppedImage = cropperImage;
                const croppedSection = cropperSelection;
                let failureNotified = false;
                const failed = () => {
                        if (failureNotified) return;
                        failureNotified = true;
                        os.alert({
                                type: "error",
                                text: i18n.ts.somethingHappened,
                        });
                        reject(new Error("failed to crop image"));
                };

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
                        const extension = selectedFile.name?.split(".").pop()?.toLowerCase();
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

                const triedTypes = Array.from(new Set([preferredMime, "image/png"]));
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
                formData.append("file", blob, `cropped_${selectedFile.name}`);
                formData.append("name", `cropped_${selectedFile.name}`);
                formData.append(
                        "isSensitive",
                        selectedFile.isSensitive ? "true" : "false",
                );
                if (selectedFile.comment) {
                        formData.append("comment", selectedFile.comment);
                }

                const folderId = defaultStore.state.uploadFolderAvatar
                        ? defaultStore.state.uploadFolderAvatar
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
                                resolve(f as DriveFile);
                        })
                        .catch(() => {
                                failed();
                        });
        });

        os.promiseDialog(promise);
        return promise;
}

async function save() {
        if (!selectedFile || saving) return;
        saving = true;
        try {
                const cropped = await cropAndUpload();
                const updated = await os.apiWithDialog("i/update", {
                        avatarId: cropped.id,
                });
                $i.avatarId = updated.avatarId;
                $i.avatarUrl = updated.avatarUrl;
                router.push("/settings/profile");
        } catch (err) {
                // noop
        } finally {
                saving = false;
        }
}

onBeforeUnmount(() => {
        destroyCropper();
});

definePageMetadata({
        title: i18n.ts._profile.iconGenerator,
        icon: "ph-magic-wand ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.icon-generator {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;

        > .header {
                display: flex;
                flex-wrap: wrap;
                gap: 0.75rem;
                align-items: center;

                > .spacer {
                        flex: 1;
                }
        }

        > .description {
                margin: 0;
                color: var(--fgFade);
        }

        > .content {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 1.5rem;
        }

        @media (min-width: 960px) {
                > .content {
                        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
                }
        }
}

.cropper-panel {
        position: relative;
        min-height: 22rem;
        border: 1px solid var(--divider);
        border-radius: var(--radius);
        background: var(--panel);
        overflow: hidden;
}

.cropper-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
}

.cropper-container {
        width: 100%;
        height: 100%;

        > ::v-deep(cropper-canvas) {
                width: 100%;
                height: 100%;
        }
}

.loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        -webkit-backdrop-filter: var(--blur, blur(10px));
        backdrop-filter: var(--blur, blur(10px));
        background: rgba(0, 0, 0, 0.35);
        z-index: 2;
}

.empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        text-align: center;
        padding: 3rem 1rem;
        color: var(--fg);

        > i {
                font-size: 3rem;
                color: var(--accent);
        }
}

.preview-panel {
        border: 1px solid var(--divider);
        border-radius: var(--radius);
        background: var(--panel);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;

        > h2 {
                margin: 0;
                font-size: 1.1rem;
        }

        > .hint {
                margin: 0;
                color: var(--fgFade);
                font-size: 0.9rem;
        }
}

.preview-list {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
}

.preview-row {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1rem;
        align-items: center;
}

.preview-label {
        font-weight: 600;
        font-size: 0.95rem;
}

.preview-boxes {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
}

.preview-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--fgFade);
}

.preview-image {
        position: relative;
        width: var(--preview-size);
        height: var(--preview-size);
        border-radius: 0.75rem;
        overflow: hidden;
        border: 1px solid var(--divider);
        background-image:
                linear-gradient(45deg, rgba(0, 0, 0, 0.08) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.08) 75%, rgba(0, 0, 0, 0.08)),
                linear-gradient(45deg, transparent 25%, rgba(0, 0, 0, 0.08) 25%, rgba(0, 0, 0, 0.08) 75%, transparent 75%, transparent);
        background-size: 1rem 1rem;
        background-position: 0 0, 0.5rem 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;

        &.circle {
                border-radius: 50%;
        }

        > img {
                width: 100%;
                height: 100%;
                object-fit: cover;
        }

        > span {
                color: var(--fgFade);
                font-size: 0.85rem;
        }
}

.fade-enter-active,
.fade-leave-active {
        transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
        opacity: 0;
}
</style>
