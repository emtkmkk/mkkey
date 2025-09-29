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
                                <div class="cropper-panel" :style="cropperPanelStyle">
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
                                                        v-for="item in selectionUiItems"
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
                                                                <input
                                                                        v-model="selectionInputs[item.key]"
                                                                        type="number"
                                                                        inputmode="numeric"
                                                                        class="selection-input"
                                                                        @change="commitSelectionInput(item.key)"
                                                                        @keydown.enter.prevent="commitSelectionInput(item.key)"
                                                                        @blur="commitSelectionInput(item.key)"
                                                                />
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
import type { CropperCanvas, CropperImage, CropperSelection } from "cropperjs";
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

const selectionUiItems = [
        { key: "x", label: "開始位置X" },
        { key: "y", label: "開始位置Y" },
        { key: "size", label: "サイズ" },
] as const;

type SelectionSnapshot = { x: number; y: number; width: number; height: number };
type CropperSelectionData = Partial<SelectionSnapshot> | null | undefined;
type SelectionUiKey = (typeof selectionUiItems)[number]["key"];

const selectionInfo = reactive<SelectionSnapshot>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
});

const selectionInputs = reactive<Record<SelectionUiKey, string>>({
        x: "0",
        y: "0",
        size: "0",
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
let imageAspectRatio = $ref(1);

const canUndo = $computed(() => historyIndex > 0);
const canRedo = $computed(
        () => historyIndex >= 0 && historyIndex < selectionHistory.length - 1,
);
type CropperHandleElement = HTMLElement & { action?: string };
const cropperPanelStyle = $computed(() => {
        const ratio = selectedFile ? imageAspectRatio : 1;
        const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
        return {
                "--cropper-panel-aspect": String(safeRatio),
        };
});

let selectedFile = $ref<DriveFile | null>(null);
let imgEl = $ref<HTMLImageElement | null>(null);
let cropper: Cropper | null = null;
let cropperCanvas: CropperCanvas | null = null;
let cropperImage: CropperImage | null = null;
let cropperSelection: CropperSelection | null = null;
let selectionChangeListener: ((event: Event) => void) | null = null;
let canvasActionEndListener: ((event: Event) => void) | null = null;
let imageTransformListener: ((event: Event) => void) | null = null;
let containEnforcementFrame: number | null = null;
let suppressContainEnforcement = false;
let loading = $ref(false);
let downloading = $ref(false);
let previewUpdating = false;
let previewPending = false;

function ensureContainEnforcement() {
        if (containEnforcementFrame != null) {
                return;
        }

        const step = () => {
                if (!cropperImage) {
                        containEnforcementFrame = null;
                        return;
                }

                if (!suppressContainEnforcement) {
                        try {
                                cropperImage?.$center("contain");
                        } catch (err) {
                                // noop - guard against unexpected runtime issues
                        }
                }

                containEnforcementFrame = window.requestAnimationFrame(step);
        };

        containEnforcementFrame = window.requestAnimationFrame(step);
}

function cancelContainEnforcement() {
        if (containEnforcementFrame != null) {
                window.cancelAnimationFrame(containEnforcementFrame);
                containEnforcementFrame = null;
        }
}

function runWithContainSuppressed(callback: () => void) {
        const previous = suppressContainEnforcement;
        suppressContainEnforcement = true;
        try {
                callback();
        } finally {
                suppressContainEnforcement = previous;
                if (!previous) {
                        ensureContainEnforcement();
                }
        }
}

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
        syncSelectionInputs();
        selectionHistory.length = 0;
        historyIndex = -1;
        cancelPendingHistory();
        lastSelectionSnapshot = null;
        pendingPreviewSnapshot = null;
        imageAspectRatio = 1;
}

function clamp(value: number, min: number, max: number) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
}

type SelectionBounds = {
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
};

type SelectionRenderInfo = {
        sourceX: number;
        sourceY: number;
        sourceSize: number;
};

type CropperImageTransformDetail = {
        matrix?: number[];
};

function getSelectionBounds(): SelectionBounds | null {
        if (!cropperCanvas) return null;
        const canvasRect = cropperCanvas.getBoundingClientRect();
        if (!canvasRect.width || !canvasRect.height) {
                return null;
        }
        const imageRect = cropperImage?.getBoundingClientRect();
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

function getNaturalScaleX(bounds: SelectionBounds | null = getSelectionBounds()) {
        if (!bounds) return 1;
        const naturalWidth = imgEl?.naturalWidth;
        if (!naturalWidth) return 1;
        const scale = naturalWidth / Math.max(1, bounds.width);
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function getNaturalScaleY(bounds: SelectionBounds | null = getSelectionBounds()) {
        if (!bounds) return 1;
        const naturalHeight = imgEl?.naturalHeight;
        if (!naturalHeight) return 1;
        const scale = naturalHeight / Math.max(1, bounds.height);
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function getSelectionRenderInfo(
        snapshot: SelectionSnapshot | null = getSelectionSnapshot(),
): SelectionRenderInfo | null {
        if (!snapshot) return null;
        const bounds = getSelectionBounds();
        if (!bounds) return null;
        const naturalWidth = imgEl?.naturalWidth;
        const naturalHeight = imgEl?.naturalHeight;
        if (!naturalWidth || !naturalHeight) return null;

        const scaleX = naturalWidth / Math.max(1, bounds.width);
        const scaleY = naturalHeight / Math.max(1, bounds.height);
        const sizeScale = Math.max(scaleX, scaleY);

        const relativeX = snapshot.x - bounds.offsetX;
        const relativeY = snapshot.y - bounds.offsetY;

        const baseX = Math.round(relativeX * scaleX);
        const baseY = Math.round(relativeY * scaleY);
        const baseSize = Math.round(snapshot.width * sizeScale);

        const clampedX = clamp(baseX, 0, Math.max(0, naturalWidth - 1));
        const clampedY = clamp(baseY, 0, Math.max(0, naturalHeight - 1));
        const maxSize = Math.min(
                Math.max(1, naturalWidth - clampedX),
                Math.max(1, naturalHeight - clampedY),
        );
        const sourceSize = Math.max(1, Math.min(baseSize, maxSize));

        return {
                sourceX: clampedX,
                sourceY: clampedY,
                sourceSize,
        };
}

function renderSelectionCanvas(
        snapshot: SelectionSnapshot | null,
        targetSize?: number,
        smoothing = true,
): HTMLCanvasElement | null {
        if (!imgEl) return null;
        const renderInfo = getSelectionRenderInfo(snapshot);
        if (!renderInfo) return null;

        const outputSize = Math.round(
                Math.max(1, targetSize ?? renderInfo.sourceSize),
        );

        const canvas = document.createElement("canvas");
        canvas.width = outputSize;
        canvas.height = outputSize;

        const context = canvas.getContext("2d");
        if (!context) {
                return null;
        }

        context.imageSmoothingEnabled = smoothing;
        context.imageSmoothingQuality = smoothing ? "high" : "low";
        context.clearRect(0, 0, outputSize, outputSize);
        context.drawImage(
                imgEl,
                renderInfo.sourceX,
                renderInfo.sourceY,
                renderInfo.sourceSize,
                renderInfo.sourceSize,
                0,
                0,
                outputSize,
                outputSize,
        );

        return canvas;
}

function shouldPreventContainTransform(matrix: number[]) {
        if (!cropperCanvas || !cropperImage) return false;

        const canvasRect = cropperCanvas.getBoundingClientRect();
        if (!canvasRect.width || !canvasRect.height) {
                return false;
        }

        const clone = cropperImage.cloneNode() as CropperImage;
        clone.style.transform = `matrix(${matrix.join(", ")})`;
        clone.style.opacity = "0";
        cropperCanvas.appendChild(clone);

        const imageRect = clone.getBoundingClientRect();
        cropperCanvas.removeChild(clone);

        if (!imageRect.width || !imageRect.height) {
                return false;
        }

        return (
                (imageRect.top > canvasRect.top && imageRect.right < canvasRect.right) ||
                (imageRect.right < canvasRect.right && imageRect.bottom < canvasRect.bottom) ||
                (imageRect.bottom < canvasRect.bottom && imageRect.left > canvasRect.left) ||
                (imageRect.left > canvasRect.left && imageRect.top > canvasRect.top)
        );
}

function clampSelectionSnapshot(snapshot: SelectionSnapshot): SelectionSnapshot {
        const bounds = getSelectionBounds();
        if (!bounds) {
                return { ...snapshot };
        }

        const maxSize = Math.min(bounds.width, bounds.height);
        let size = Math.round(Math.max(1, Math.min(snapshot.width, snapshot.height)));
        if (size > maxSize) {
                size = maxSize;
        }

        const maxX = bounds.offsetX + Math.max(0, bounds.width - size);
        const maxY = bounds.offsetY + Math.max(0, bounds.height - size);

        const x = clamp(Math.round(snapshot.x), bounds.offsetX, maxX);
        const y = clamp(Math.round(snapshot.y), bounds.offsetY, maxY);

        return { x, y, width: size, height: size };
}

function isSameSelection(a: SelectionSnapshot, b: SelectionSnapshot) {
        return (
                a.x === b.x &&
                a.y === b.y &&
                a.width === b.width &&
                a.height === b.height
        );
}

function syncSelectionInputs() {
        const bounds = getSelectionBounds();
        const scaleX = getNaturalScaleX(bounds);
        const scaleY = getNaturalScaleY(bounds);
        const sizeScale = Math.max(scaleX, scaleY);
        selectionInputs.x = Math.round(selectionInfo.x * scaleX).toString();
        selectionInputs.y = Math.round(selectionInfo.y * scaleY).toString();
        const size = Math.max(selectionInfo.width, selectionInfo.height);
        selectionInputs.size = Math.round(size * sizeScale).toString();
}

function setHandleAction(element: Element | null | undefined, action: string) {
        const handle = element as CropperHandleElement | null;
        if (!handle) return;
        if (typeof handle.action !== "undefined") {
                handle.action = action;
        }
        handle.setAttribute("action", action);
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
        const widthValue = Number(width);
        const heightValue = Number(height);
        const sizeSource = Math.max(
                Number.isFinite(widthValue) ? widthValue : 0,
                Number.isFinite(heightValue) ? heightValue : 0,
        );
        const size = Math.round(Math.max(0, sizeSource));
        return {
                x: Math.round(Number(x) || 0),
                y: Math.round(Number(y) || 0),
                width: size,
                height: size,
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

        if (cropperSelection) {
                const fallback = toSelectionSnapshot({
                        x: cropperSelection.x,
                        y: cropperSelection.y,
                        width: cropperSelection.width,
                        height: cropperSelection.height,
                });
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

        const bounds = getSelectionBounds();
        if (bounds) {
                const x = clamp(
                        snapshot.x - bounds.offsetX,
                        0,
                        Math.max(0, bounds.width - snapshot.width),
                );
                const y = clamp(
                        snapshot.y - bounds.offsetY,
                        0,
                        Math.max(0, bounds.height - snapshot.height),
                );
                selectionInfo.x = x;
                selectionInfo.y = y;
        } else {
                selectionInfo.x = snapshot.x;
                selectionInfo.y = snapshot.y;
        }
        const size = Math.max(snapshot.width, snapshot.height);
        selectionInfo.width = size;
        selectionInfo.height = size;
        syncSelectionInputs();

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
        const rawSnapshot = getSelectionSnapshot(source);
        if (!rawSnapshot) return;
        const clamped = clampSelectionSnapshot(rawSnapshot);
        if (cropperSelection && !isSameSelection(rawSnapshot, clamped)) {
                cropperSelection.$change(
                        clamped.x,
                        clamped.y,
                        clamped.width,
                        clamped.height,
                );
                if (recordHistory) {
                        const snapshot = captureSelectionData(true, clamped);
                        if (snapshot) {
                                schedulePreviewUpdate(snapshot);
                        }
                }
                return;
        }
        const snapshot = captureSelectionData(recordHistory, clamped);
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

function adjustSelection(key: SelectionUiKey, delta: number) {
        if (!cropperSelection) return;
        const bounds = getSelectionBounds();
        if (!bounds) return;
        const snapshot = getSelectionSnapshot();
        if (!snapshot) return;
        const updated: SelectionSnapshot = { ...snapshot };
        const scaleX = getNaturalScaleX(bounds);
        const scaleY = getNaturalScaleY(bounds);
        const sizeScale = Math.max(scaleX, scaleY);

        if (key === "x" || key === "y") {
                const offsetKey = key === "x" ? "offsetX" : "offsetY";
                const scaleValue = key === "x" ? scaleX : scaleY;
                const currentDisplay =
                        key === "x" ? updated.x - bounds.offsetX : updated.y - bounds.offsetY;
                const maxDisplay = key === "x"
                        ? Math.max(0, bounds.width - updated.width)
                        : Math.max(0, bounds.height - updated.height);
                const currentNatural = Math.round(currentDisplay * scaleValue);
                const maxNatural = Math.round(maxDisplay * scaleValue);
                const nextNatural = Math.round(clamp(currentNatural + delta, 0, maxNatural));
                const nextDisplay = nextNatural / scaleValue;
                updated[key] = Math.round(nextDisplay + bounds[offsetKey]);
        } else if (key === "size") {
                const maxSize = Math.min(bounds.width, bounds.height);
                const currentSize = Math.max(updated.width, updated.height);
                const currentNatural = Math.round(currentSize * sizeScale);
                const maxNatural = Math.round(maxSize * sizeScale);
                const desiredNatural = Math.round(
                        clamp(currentNatural + delta, 1, Math.max(1, maxNatural)),
                );
                const desiredSize = desiredNatural / sizeScale;
                const roundedSize = Math.max(1, Math.round(desiredSize));
                updated.width = roundedSize;
                updated.height = roundedSize;

                const maxX = bounds.offsetX + Math.max(0, bounds.width - roundedSize);
                const maxY = bounds.offsetY + Math.max(0, bounds.height - roundedSize);
                updated.x = clamp(updated.x, bounds.offsetX, maxX);
                updated.y = clamp(updated.y, bounds.offsetY, maxY);
        }

        cropperSelection.$change(
                updated.x,
                updated.y,
                updated.width,
                updated.height,
        );
        handleSelectionChange(true, updated);
}

function commitSelectionInput(key: SelectionUiKey) {
        if (!cropperSelection) return;
        const bounds = getSelectionBounds();
        if (!bounds) return;
        const snapshot = getSelectionSnapshot();
        if (!snapshot) return;

        const rawValue = selectionInputs[key];
        const parsedValue = Number(rawValue);
        if (!Number.isFinite(parsedValue)) {
                syncSelectionInputs();
                return;
        }

        const updated: SelectionSnapshot = { ...snapshot };
        const scaleX = getNaturalScaleX(bounds);
        const scaleY = getNaturalScaleY(bounds);
        const sizeScale = Math.max(scaleX, scaleY);

        if (key === "x" || key === "y") {
                const scaleValue = key === "x" ? scaleX : scaleY;
                const maxDisplay = key === "x"
                        ? Math.max(0, bounds.width - updated.width)
                        : Math.max(0, bounds.height - updated.height);
                const maxValue = Math.round(maxDisplay * scaleValue);
                const offsetKey = key === "x" ? "offsetX" : "offsetY";
                const value = clamp(Math.round(parsedValue), 0, Math.max(0, maxValue));
                const displayValue = value / scaleValue;
                updated[key] = Math.round(displayValue + bounds[offsetKey]);
        } else if (key === "size") {
                const maxSize = Math.min(bounds.width, bounds.height);
                const maxValue = Math.round(maxSize * sizeScale);
                const value = clamp(Math.round(parsedValue), 1, Math.max(1, maxValue));
                const displaySize = value / sizeScale;
                const roundedSize = Math.max(1, Math.round(displaySize));
                updated.width = roundedSize;
                updated.height = roundedSize;

                const maxX = bounds.offsetX + Math.max(0, bounds.width - roundedSize);
                const maxY = bounds.offsetY + Math.max(0, bounds.height - roundedSize);
                updated.x = clamp(updated.x, bounds.offsetX, maxX);
                updated.y = clamp(updated.y, bounds.offsetY, maxY);
        }

        cropperSelection.$change(
                updated.x,
                updated.y,
                updated.width,
                updated.height,
        );
        handleSelectionChange(true, updated);
}

function applyHistory(index: number) {
        if (!cropperSelection) return;
        const snapshot = selectionHistory[index];
        if (!snapshot) return;
        cancelPendingHistory();
        historyIndex = index;
        historySuppressUntil = Date.now() + 200;
        cropperSelection.$change(
                snapshot.x,
                snapshot.y,
                snapshot.width,
                snapshot.height,
        );
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
        if (imgEl?.naturalWidth && imgEl.naturalHeight) {
                imageAspectRatio = imgEl.naturalWidth / imgEl.naturalHeight;
        } else {
                imageAspectRatio = 1;
        }
        loading = false;
}

function setupCropper() {
        if (!imgEl) return;

        destroyCropper();

        cropper = new Cropper(imgEl);

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
                if (cropperImage) {
                        cropperImage.translatable = true;
                        cropperImage.rotatable = false;
                        cropperImage.scalable = true;
                }
                ensureContainEnforcement();
                cropperSelection = selection;

                if (selectionChangeListener) {
                        selection.removeEventListener(
                                "change",
                                selectionChangeListener as EventListener,
                        );
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
                selection.addEventListener(
                        "change",
                        selectionChangeListener as EventListener,
                );

                if (imageTransformListener) {
                        image.removeEventListener(
                                "transform",
                                imageTransformListener as EventListener,
                        );
                }
                imageTransformListener = (event: Event) => {
                        const detail = (event as CustomEvent<CropperImageTransformDetail>).detail;
                        const matrix = detail?.matrix;
                        if (matrix && shouldPreventContainTransform(matrix)) {
                                event.preventDefault();
                                return;
                        }
                        if (!cropperSelection) {
                                return;
                        }
                        handleSelectionChange(false, {
                                x: cropperSelection.x,
                                y: cropperSelection.y,
                                width: cropperSelection.width,
                                height: cropperSelection.height,
                        });
                };
                image.addEventListener(
                        "transform",
                        imageTransformListener as EventListener,
                );

                if (canvasActionEndListener) {
                        canvas.removeEventListener(
                                "actionend",
                                canvasActionEndListener as EventListener,
                        );
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
                canvas.addEventListener(
                        "actionend",
                        canvasActionEndListener as EventListener,
                );

                selection.aspectRatio = 1;
                selection.initialAspectRatio = 1;
                selection.initialCoverage = 1;
                selection.movable = true;
                selection.resizable = true;
                selection.keyboard = true;
                selection.outlined = true;
                selection.precise = true;

                setHandleAction(
                        canvas.querySelector('cropper-handle[action="select"]'),
                        "none",
                );

                const initializeSelection = () => {
                        if (!cropperSelection || cropperSelection !== selection) {
                                return;
                        }
                        runWithContainSuppressed(() => {
                                cropperImage?.$center("contain");
                        });
                        const bounds = getSelectionBounds();
                        if (bounds) {
                                const size = Math.min(bounds.width, bounds.height);
                                const x = bounds.offsetX + Math.max(0, (bounds.width - size) / 2);
                                const y = bounds.offsetY + Math.max(0, (bounds.height - size) / 2);
                                const initial = clampSelectionSnapshot({
                                        x,
                                        y,
                                        width: size,
                                        height: size,
                                });
                                selection.$change(
                                        initial.x,
                                        initial.y,
                                        initial.width,
                                        initial.height,
                                        1,
                                );
                        }
                        selection.$center();
                        handleSelectionChange(true, {
                                x: selection.x,
                                y: selection.y,
                                width: selection.width,
                                height: selection.height,
                        });
                };

                window.setTimeout(initializeSelection, 50);
        };

        initializeElements();
}

function destroyCropper() {
        cancelContainEnforcement();
        suppressContainEnforcement = false;
        if (cropperSelection && selectionChangeListener) {
                cropperSelection.removeEventListener(
                        "change",
                        selectionChangeListener as EventListener,
                );
        }
        if (cropperImage && imageTransformListener) {
                cropperImage.removeEventListener(
                        "transform",
                        imageTransformListener as EventListener,
                );
        }
        if (cropperCanvas && canvasActionEndListener) {
                cropperCanvas.removeEventListener(
                        "actionend",
                        canvasActionEndListener as EventListener,
                );
        }
        selectionChangeListener = null;
        canvasActionEndListener = null;
        imageTransformListener = null;
        cropperCanvas = null;
        cropperImage = null;
        cropperSelection = null;

        if (cropper) {
                const container = cropper.container;
                if (container && imgEl) {
                        let next = imgEl.nextElementSibling;
                        while (next && next.tagName.startsWith("CROPPER-")) {
                                const current = next;
                                next = next.nextElementSibling;
                                current.remove();
                        }
                }
        }

        cropper = null;
        resetSelectionState();
}

function schedulePreviewUpdate(source?: CropperSelectionData | SelectionSnapshot) {
        if (!selectedFile || !cropperSelection) return;
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
        const target = snapshot
                ?? (lastSelectionSnapshot ? { ...lastSelectionSnapshot } : getSelectionSnapshot());
        if (!target || !target.width || !target.height) {
                previewSizes.forEach((size) => {
                        previewSources[size] = null;
                });
                return;
        }
        previewSizes.forEach((size) => {
                const canvas = renderSelectionCanvas(target, size, true);
                previewSources[size] = canvas ? canvas.toDataURL("image/png") : null;
        });
}

async function cropSelection(): Promise<{ blob: Blob; filename: string }> {
        if (!selectedFile || !cropperSelection) {
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

        const croppedCanvas = renderSelectionCanvas(snapshot, undefined, false);
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
        --cropper-panel-aspect: 1;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: min(22rem, 70vh);
        max-height: min(70vh, 40rem);
        min-width: 0;
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        border: 1px solid var(--divider);
        border-radius: var(--radius);
        background: var(--panel);
        overflow: hidden;
        aspect-ratio: var(--cropper-panel-aspect, 1);
}

.cropper-wrapper {
        position: relative;
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        max-width: 100%;
        width: 100%;
        height: 100%;

        > ::v-deep(.cropper-container) {
                flex: 1 1 auto;
                min-height: 0;
                width: 100% !important;
                max-width: 100%;
                height: 100% !important;
        }

}

.cropper-panel > .empty {
        flex: 1 1 auto;
        width: 100%;
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

        > ::v-deep(canvas),
        > ::v-deep(img) {
                image-rendering: pixelated;
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

.selection-input {
        width: 4.5rem;
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--divider);
        background: var(--panel);
        color: var(--fg);
        font-variant-numeric: tabular-nums;
        text-align: right;
}

.selection-input:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
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
