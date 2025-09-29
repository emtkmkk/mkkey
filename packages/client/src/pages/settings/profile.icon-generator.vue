<template>
        <div class="icon-generator _formRoot">
                <div class="header">
                        <MkButton inline @click="goBack">
                                <i class="ph-arrow-left ph-bold ph-lg"></i>
                                {{ i18n.ts.back }}
                        </MkButton>
                        <div class="spacer"></div>
                        <MkButton inline :disabled="downloading" @click="pickImage">
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
                                :disabled="!selectedFile || downloading"
                                @click="downloadImage"
                        >
                                {{ downloading ? i18n.ts.processing : i18n.ts.download }}
                        </MkButton>
                </div>
                <p class="description">{{ i18n.ts._profile.iconGeneratorDescription }}</p>
                <div class="content">
                        <div class="cropper-area">
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
                                <div
                                        v-if="selectedFile"
                                        class="selection-panel"
                                >
                                        <div class="selection-values">
                                                <div
                                                        v-for="item in selectionItems"
                                                        :key="item.key"
                                                        class="selection-item"
                                                >
                                                        <span class="selection-label">
                                                                {{ item.label }}
                                                        </span>
                                                        <div class="selection-control">
                                                                <button
                                                                        type="button"
                                                                        class="selection-button"
                                                                        @click="adjustSelection(item.key, -1)"
                                                                >
                                                                        -1
                                                                </button>
                                                                <span class="selection-value">
                                                                        {{ selectionInfo[item.key] }}
                                                                </span>
                                                                <button
                                                                        type="button"
                                                                        class="selection-button"
                                                                        @click="adjustSelection(item.key, 1)"
                                                                >
                                                                        +1
                                                                </button>
                                                        </div>
                                                </div>
                                        </div>
                                        <div class="history-controls">
                                                <MkButton
                                                        inline
                                                        :disabled="!canUndo"
                                                        title="元に戻す"
                                                        aria-label="元に戻す"
                                                        @click="undo"
                                                >
                                                        <i class="ph-arrow-counter-clockwise ph-bold"></i>
                                                </MkButton>
                                                <MkButton
                                                        inline
                                                        :disabled="!canRedo"
                                                        title="やり直す"
                                                        aria-label="やり直す"
                                                        @click="redo"
                                                >
                                                        <i class="ph-arrow-clockwise ph-bold"></i>
                                                </MkButton>
                                        </div>
                                </div>
                        </div>
                        <div v-if="selectedFile" class="preview-panel">
                                <h2>{{ i18n.ts.preview }}</h2>
                                <div class="preview-list">
                                        <div
                                                v-for="size in previewSizes"
                                                :key="size"
                                                class="preview-row"
                                        >
                                                <div class="preview-label">{{ size }}px</div>
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
import type { DriveFile } from "calckey-js/built/entities";
import MkButton from "@/components/MkButton.vue";
import { selectFile } from "@/scripts/select-file";
import { i18n } from "@/i18n";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { url } from "@/config";
import { query } from "@/scripts/url";
import * as os from "@/os";

const router = useRouter();

const previewSizes = [184, 64, 32] as const;
const previewSources = reactive<Record<number, string | null>>({
        184: null,
        64: null,
        32: null,
});

const selectionInfo = reactive<SelectionSnapshot>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
});

const selectionHistory = reactive<SelectionSnapshot[]>([]);
const MAX_HISTORY = 16;
const HISTORY_COMMIT_DELAY = 1000;
let historyIndex = $ref(-1);
let historyTimer: ReturnType<typeof window.setTimeout> | null = null;
let pendingHistory: SelectionSnapshot | null = null;
let historySuppressUntil = 0;
let lastSelectionSnapshot: SelectionSnapshot | null = null;
let pendingPreviewSnapshot: SelectionSnapshot | null = null;

const canUndo = $computed(() => historyIndex > 0);
const canRedo = $computed(
        () => historyIndex >= 0 && historyIndex < selectionHistory.length - 1,
);

const selectionItems = [
        { key: "x", label: "開始位置X" },
        { key: "y", label: "開始位置Y" },
        { key: "width", label: "サイズX" },
        { key: "height", label: "サイズY" },
] as const;

type SelectionKey = (typeof selectionItems)[number]["key"];

type SelectionSnapshot = Record<SelectionKey, number>;
type CropperSelectionData = Partial<Record<SelectionKey, number | null>> | null | undefined;

let selectedFile = $ref<DriveFile | null>(null);
let imgEl = $ref<HTMLImageElement | null>(null);
let cropper: Cropper | null = null;
let loading = $ref(false);
let downloading = $ref(false);
let previewUpdating = false;
let previewPending = false;

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

function resetSelectionState() {
        selectionInfo.x = 0;
        selectionInfo.y = 0;
        selectionInfo.width = 0;
        selectionInfo.height = 0;
        selectionHistory.length = 0;
        historyIndex = -1;
        cancelPendingHistory();
        lastSelectionSnapshot = null;
        pendingPreviewSnapshot = null;
}

function toSelectionSnapshot(source: CropperSelectionData | SelectionSnapshot): SelectionSnapshot | null {
        if (!source) return null;
        const { x, y, width, height } = source;
        if (
                x == null ||
                y == null ||
                width == null ||
                height == null
        ) {
                return null;
        }
        return {
                x: Math.round(Number(x) || 0),
                y: Math.round(Number(y) || 0),
                width: Math.round(Number(width) || 0),
                height: Math.round(Number(height) || 0),
        };
}

function getSelectionSnapshot(source?: CropperSelectionData | SelectionSnapshot): SelectionSnapshot | null {
        const snapshot = source ? toSelectionSnapshot(source) : null;
        if (snapshot) {
                lastSelectionSnapshot = snapshot;
                return { ...snapshot };
        }

        if (lastSelectionSnapshot) {
                return { ...lastSelectionSnapshot };
        }

        if (cropper && typeof (cropper as { getData?: (rounded?: boolean) => unknown }).getData === "function") {
                const data = cropper.getData(true) as CropperSelectionData;
                const fallback = toSelectionSnapshot(data);
                if (fallback) {
                        lastSelectionSnapshot = fallback;
                        return { ...fallback };
                }
        }

        return null;
}

function captureSelectionData(
        recordHistory = false,
        source?: CropperSelectionData | SelectionSnapshot,
) {
        const snapshot = getSelectionSnapshot(source);
        if (!snapshot) return null;

        selectionInfo.x = snapshot.x;
        selectionInfo.y = snapshot.y;
        selectionInfo.width = snapshot.width;
        selectionInfo.height = snapshot.height;

        if (!recordHistory) {
                return snapshot;
        }

        scheduleHistoryCommit(snapshot);
        return snapshot;
}

function handleSelectionChange(
        recordHistory: boolean,
        source?: CropperSelectionData | SelectionSnapshot,
) {
        const snapshot = captureSelectionData(recordHistory, source);
        if (!snapshot) return;
        schedulePreviewUpdate(snapshot);
}

function scheduleHistoryCommit(snapshot: SelectionSnapshot) {
        if (Date.now() < historySuppressUntil) {
                return;
        }

        pendingHistory = { ...snapshot };
        if (historyTimer) {
                window.clearTimeout(historyTimer);
        }
        historyTimer = window.setTimeout(() => {
                historyTimer = null;
                if (!pendingHistory) return;
                commitHistorySnapshot(pendingHistory);
                pendingHistory = null;
        }, HISTORY_COMMIT_DELAY);
}

function commitHistorySnapshot(snapshot: SelectionSnapshot) {
        if (
                historyIndex >= 0 &&
                historyIndex < selectionHistory.length &&
                selectionHistory[historyIndex].x === snapshot.x &&
                selectionHistory[historyIndex].y === snapshot.y &&
                selectionHistory[historyIndex].width === snapshot.width &&
                selectionHistory[historyIndex].height === snapshot.height
        ) {
                return;
        }

        selectionHistory.splice(historyIndex + 1);
        selectionHistory.push({ ...snapshot });
        if (selectionHistory.length > MAX_HISTORY) {
                const overflow = selectionHistory.length - MAX_HISTORY;
                selectionHistory.splice(0, overflow);
        }
        historyIndex = selectionHistory.length - 1;
}

function cancelPendingHistory() {
        if (historyTimer) {
                window.clearTimeout(historyTimer);
                historyTimer = null;
        }
        pendingHistory = null;
}

function adjustSelection(key: SelectionKey, delta: number) {
        if (!cropper) return;
        const snapshot = getSelectionSnapshot();
        if (!snapshot) return;
        const updated: SelectionSnapshot = { ...snapshot };
        updated[key] += delta;
        if ((key === "width" || key === "height") && updated[key] < 1) {
                updated[key] = 1;
        }
        cropper.setData({
                x: updated.x,
                y: updated.y,
                width: updated.width,
                height: updated.height,
        });
        const nextSnapshot = captureSelectionData(true, updated);
        if (nextSnapshot) {
                schedulePreviewUpdate(nextSnapshot);
        }
}

function applyHistory(index: number) {
        if (!cropper) return;
        const snapshot = selectionHistory[index];
        if (!snapshot) return;
        cancelPendingHistory();
        historyIndex = index;
        historySuppressUntil = Date.now() + 200;
        cropper.setData({
                x: snapshot.x,
                y: snapshot.y,
                width: snapshot.width,
                height: snapshot.height,
        });
        const nextSnapshot = captureSelectionData(false, snapshot);
        if (nextSnapshot) {
                schedulePreviewUpdate(nextSnapshot);
        }
}

function undo() {
        if (historyIndex <= 0) return;
        applyHistory(historyIndex - 1);
}

function redo() {
        if (historyIndex < 0) return;
        if (historyIndex >= selectionHistory.length - 1) return;
        applyHistory(historyIndex + 1);
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
                resetSelectionState();
                resetPreviews();
                await nextTick();
                setupCropper();
        } catch (err) {
                // noop
        }
}

function onImageLoad() {
        loading = false;
}

function setupCropper() {
        if (!imgEl) return;

        destroyCropper();

        cropper = new Cropper(imgEl, {
                dragMode: "none",
                aspectRatio: 1,
                viewMode: 2,
                autoCrop: true,
                autoCropArea: 1,
                background: false,
                responsive: true,
                ready(event) {
                        loading = false;
                        handleSelectionChange(true, event?.detail ?? null);
                },
                crop(event) {
                        handleSelectionChange(false, event?.detail ?? null);
                },
                cropend(event) {
                        handleSelectionChange(true, event?.detail ?? null);
                },
                zoom(event) {
                        handleSelectionChange(false, event?.detail ?? null);
                },
        });

}

function destroyCropper() {
        cropper?.destroy();
        cropper = null;
        resetSelectionState();
}

function schedulePreviewUpdate(source?: CropperSelectionData | SelectionSnapshot) {
        if (!selectedFile || !cropper) return;
        const snapshot = source
                ? getSelectionSnapshot(source)
                : lastSelectionSnapshot
                  ? { ...lastSelectionSnapshot }
                  : null;
        if (snapshot) {
                pendingPreviewSnapshot = snapshot;
        }
        if (previewUpdating) {
                previewPending = true;
                return;
        }
        previewUpdating = true;
        updatePreviews(pendingPreviewSnapshot)
                .catch(() => {})
                .finally(() => {
                        previewUpdating = false;
                        pendingPreviewSnapshot = null;
                        if (previewPending) {
                                previewPending = false;
                                schedulePreviewUpdate();
                        }
                });
}

async function updatePreviews(snapshot?: SelectionSnapshot | null) {
        if (!cropper) return;
        const target = snapshot
                ?? (lastSelectionSnapshot ? { ...lastSelectionSnapshot } : getSelectionSnapshot());
        if (!target || !target.width || !target.height) {
                previewSizes.forEach((size) => {
                        previewSources[size] = null;
                });
                return;
        }
        const canvases = previewSizes.map((size) => {
                try {
                        return cropper.getCroppedCanvas({
                                width: size,
                                height: size,
                                imageSmoothingQuality: "high",
                        });
                } catch (err) {
                        return null;
                }
        });
        canvases.forEach((canvas, index) => {
                const size = previewSizes[index];
                previewSources[size] = canvas ? canvas.toDataURL("image/png") : null;
        });
}

async function cropSelection(): Promise<{ blob: Blob; filename: string }> {
        if (!selectedFile || !cropper) {
                throw new Error("cropper is not ready");
        }

        let failureNotified = false;
        const fail = (): never => {
                if (failureNotified) {
                        throw new Error("failed to crop image");
                }
                failureNotified = true;
                os.alert({
                        type: "error",
                        text: i18n.ts.somethingHappened,
                });
                throw new Error("failed to crop image");
        };

        const snapshot = getSelectionSnapshot();
        if (!snapshot || !snapshot.width || !snapshot.height) {
                return fail();
        }

        let croppedCanvas: HTMLCanvasElement | null = null;
        try {
                croppedCanvas = cropper.getCroppedCanvas({
                        width: Math.round(Math.max(1, snapshot.width)),
                        height: Math.round(Math.max(1, snapshot.height)),
                        imageSmoothingQuality: "high",
                });
        } catch (err) {
                croppedCanvas = null;
        }
        if (!croppedCanvas) {
                return fail();
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
                        croppedCanvas?.toBlob((canvasBlob) => {
                                resolve(canvasBlob);
                        }, type);
                });
                if (blob) break;
        }

        if (!blob) {
                return fail();
        }

        const extensionFromMime = (mime: string) => {
                switch (mime) {
                        case "image/webp":
                                return "webp";
                        case "image/avif":
                                return "avif";
                        case "image/png":
                        default:
                                return "png";
                }
        };

        const baseName = selectedFile.name
                ? selectedFile.name.replace(/\.[^/.]+$/, "")
                : "icon";
        const safeBlob = blob;
        const extension = extensionFromMime(safeBlob.type || preferredMime);
        const filename = `cropped_${baseName}.${extension}`;

        return { blob: safeBlob, filename };
}

async function downloadImage() {
        if (!selectedFile || downloading) return;
        downloading = true;
        try {
                const { blob, filename } = await cropSelection();
                const objectUrl = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = objectUrl;
                anchor.download = filename;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(objectUrl);
        } catch (err) {
                // noop
        } finally {
                downloading = false;
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

.cropper-area {
        display: flex;
        flex-direction: column;
        gap: 1rem;
}

.cropper-panel {
        position: relative;
        min-height: 22rem;
        min-width: 0;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        border: 1px solid var(--divider);
        border-radius: var(--radius);
        background: var(--panel);
        overflow: hidden;
}

.cropper-wrapper {
        position: relative;
        min-width: 0;
        max-width: 100%;
        width: 100%;
        height: 100%;

        > ::v-deep(.cropper-container) {
                width: 100% !important;
                max-width: 100%;
                height: 100% !important;
        }

}

.cropper-container {
        min-width: 0;
        width: 100%;
        height: 100%;

        > ::v-deep(cropper-canvas) {
                width: 100% !important;
                height: 100% !important;
        }

        > ::v-deep(.cropper-wrap-box),
        > ::v-deep(.cropper-canvas),
        > ::v-deep(.cropper-drag-box),
        > ::v-deep(.cropper-crop-box),
        > ::v-deep(.cropper-face) {
                max-width: 100%;
        }
}

@media (min-width: 960px) {
        .cropper-panel {
                width: 100%;
        }
}

.selection-panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border: 1px solid var(--divider);
        border-radius: var(--radius);
        background: var(--panel);
        padding: 1rem;
}

.selection-values {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: 0.75rem;
}

.selection-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
}

.selection-label {
        font-weight: 600;
        min-width: 5rem;
}

.selection-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
}

.selection-button {
        border: 1px solid var(--divider);
        background: var(--panelHighlight);
        color: var(--fg);
        border-radius: var(--radius-sm);
        padding: 0.25rem 0.5rem;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 0.2s ease;

        &:hover {
                background: var(--panelHighlightSolid);
        }

        &:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 1px;
        }
}

.selection-value {
        font-variant-numeric: tabular-nums;
        min-width: 3rem;
        text-align: center;
}

.history-controls {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
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
