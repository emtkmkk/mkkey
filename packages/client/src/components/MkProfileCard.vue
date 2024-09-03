<template>
	<MkModalWindow
		ref="dialogEl"
		:width="1000"
		:height="800"
		:scroll="false"
		:withOkButton="false"
		@close="cancel"
		@closed="$emit('closed')"
	>
		<template #header>
			<i class="ph-identification-card ph-bold ph-lg"></i> {{ i18n.ts._profileCardGen.title }}
		</template>
	
		<div :class="$style.ProfileCardGenRoot">
			<Transition
				mode="out-in"
				:enterActiveClass="$style.transition_x_enterActive"
				:leaveActiveClass="$style.transition_x_leaveActive"
				:enterFromClass="$style.transition_x_enterFrom"
				:leaveToClass="$style.transition_x_leaveTo"
			>
				<div v-if="phase === 'input'" key="input" :class="$style.ProfileCardGenInputRoot">
					<div :class="$style.ProfileCardGenPreviewRoot">
						<MkLoading v-if="canvasLoading" :class="$style.ProfileCardGenPreviewSpinner"/>
						<div :class="$style.ProfileCardGenPreviewWrapper">
							<div :class="$style.ProfileCardGenPreviewTitle">{{ i18n.ts.preview }}</div>
							<div inert :class="$style.ProfileCardGenPreviewInert">
								<canvas
									ref="canvasEl"
									:class="$style.ProfileCardGenPreviewCanvas"
								></canvas>
							</div>
						</div>
					</div>
					<div :class="$style.ProfileCardGenSettings" class="_gaps">
						<MkSelect
							v-model="currentTemplate"
							@change="switchCanvasTemplate"
            >
							<template #label>テンプレートを選択</template>
							<option v-for="(value, key) in canvasTemplates" :key="key" :value="key">{{value.name ?? key}}</option>
						</MkSelect>
						<div :class="$style.caption" v-if="canvasSettings.author">{{ `${canvasSettings.author ? `テンプレートの作者: ` + canvasSettings.author : ""}` }}<br>{{ `新しいテンプレートを常に募集中です！` }}</div>
						<MkInput style="margin-top: 1em" v-model="name" :disabled="canvasLoading">
							<template #label>{{ i18n.ts.name }}</template>
							<template #caption>{{ i18n.ts._profileCardGen.nameDescription }}</template>
						</MkInput>
						<div style="margin-top: 1em" class="_buttons">
							<MkButton inline :disabled="canvasLoading" @click="applyToPreview">{{ i18n.ts._profileCardGen.applyToPreview }}</MkButton>
							<MkButton inline :disabled="canvasLoading" primary @click="generate">{{ i18n.ts._profileCardGen.generateImage }} <i class="ph-arrow-right ph-bold ph-lg"></i></MkButton>
						</div>
					</div>
				</div>
				<div v-else-if="phase === 'share'" key="share" :class="$style.ProfileCardGenResultRoot">
					<div :class="$style.ProfileCardGenResultWrapper" class="_gaps">
						<div class="_gaps_s">
							<div :class="$style.ProfileCardGenResultHeadingIcon"><i class="ph-check ph-bold ph-lg"></i></div>
							<div :class="$style.ProfileCardGenResultHeading">{{ i18n.ts._profileCardGen.imageGenerated }}</div>
							<div :class="$style.ProfileCardGenResultDescription">{{ i18n.ts._profileCardGen.imageGeneratedDescription }}</div>
						</div>
						<img style="margin-top: 1em" v-if="resultUrl" :class="$style.ProfileCardGenResultImage" :src="resultUrl" alt="Generated image"/>
						<div style="margin-top: 1em" class="_buttons">
							<MkButton rounded inline @click="note"><i class="ph-pencil ph-bold ph-lg"></i> {{ i18n.ts.note }}</MkButton>
							<MkButton rounded inline @click="download"><i class="ph-download-simple ph-bold ph-lg"></i> {{ i18n.ts.download }}</MkButton>
							<MkButton rounded inline @click="postToX"><i class="ph-x-logo ph-bold ph-lg"></i> {{ i18n.ts._profileCardGen.shareToX }}</MkButton>
							<MkButton rounded inline v-if="shareAvailable() && canFileShareAvailable()" @click="shareEtc"><i class="ph-share-network ph-bold ph-lg"></i> {{ i18n.ts._profileCardGen.share }}</MkButton>
						</div>
						<div :class="$style.ProfileCardGenResultWarning">{{ i18n.ts._profileCardGen.shareWarning }}</div>
						<div class="_buttons">
							<MkButton rounded inline transparent @click="returnToInput"><i class="ph-arrow-left ph-bold ph-lg"></i> {{ i18n.ts.goBack }}</MkButton>
							<MkButton rounded inline transparent @click="closeAndNotShowAgain">{{ i18n.ts.close }}</MkButton>
						</div>
					</div>
				</div>
			</Transition>
		</div>
	</MkModalWindow>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onDeactivated, watch } from 'vue';
import { i18n } from '@/i18n';
import { apiUrl, host } from '@/config';
import { defaultStore } from '@/store';
import * as os from '@/os';
import { $i } from "@/account";
import { shareAvailable } from "@/scripts/share-available";

import MkSelect from "@/components/form/select.vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from '@/components/form/input.vue';
import MkModalWindow from "@/components/MkModalWindow.vue";

const stats = ref<any>(null);
const canvasReady = ref(false); // キャンバスを描画して良いかどうかのフラグ

// TypeScript 型定義
type TextStyle = {
  font: string;
  x: number;
  y: number;
  fillStyle: string;
  alignRight?: boolean;
};

type CanvasTemplate = {
	name?: string | null;
	author?: string | null;
  avatarShape: 'circle' | 'square';
  avatarPosition: { x: number; y: number };
	avatarSize: { width: number; height: number };
  maxNameLength: number;
  nameStyle: TextStyle;
  backgroundImage: { url: string; size: { width: number; height: number } };
  embeddedValues: Array<{ value: string; style: TextStyle }>;
};

const emit = defineEmits<{
	(ev: 'cancel'): void;
	(ev: 'completed'): void;
	(ev: 'closed'): void;
}>();

//#region modalの制御
const dialogEl = shallowRef<InstanceType<typeof MkModalWindow>>();

function cancel() {
	emit('cancel');
	dialogEl.value?.close();
}

function closeAndNotShowAgain() {
	emit('completed');
	cancel();
}

const phase = ref<'input' | 'share'>('input');
//#endregion

//#region canvas
const canvasEl = shallowRef<HTMLCanvasElement>();
const canvasLoading = ref(true);

const name = ref($i?.name ?? $i?.username ?? "");

const canvasTemplates: Record<string, CanvasTemplate> = $computed(() => ({
  default: {
		name: "シンプル",
		author: "@magi@minazukey.uk",
    avatarShape: 'square',
    avatarPosition: { x: 32, y: 32 },
    avatarSize: { width: 190, height: 190 },
    maxNameLength: 40,
    nameStyle: {
      font: 'bold 48px "M PLUS Rounded 1c"',
      x: 256,
      y: 84,
      fillStyle: '#333333',
      alignRight: false,
    },
    backgroundImage: {
      url: `https://${host}/static-assets/cards/simple-card.png`,
      size: { width: 1280, height: 670 },
    },
    embeddedValues: [
      {
        value: `No.${stats?.value?.userNo}`,
        style: {
          font: 'bold 20px "M PLUS Rounded 1c"',
          x: 1247,
          y: 46,
          fillStyle: '#6E6E6E',
          alignRight: true,
        },
      },
      {
        value: `@${$i?.username}@${host}`,
        style: {
          font: 'bold 40px "M PLUS Rounded 1c"',
          x: 260,
          y: 170,
          fillStyle: '#6E6E6E',
          alignRight: false,
        },
      },
      {
        value: `${Math.ceil((Date.now() - (new Date($i?.createdAt ?? "")?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24))?.toLocaleString()}`,
        style: {
          font: 'bold 32px "M PLUS Rounded 1c"',
          x: 466,
          y: 303,
          fillStyle: '#E97979',
          alignRight: true,
        },
      },
      {
        value: `${$i?.notesCount?.toLocaleString()}`,
        style: {
          font: 'bold 32px "M PLUS Rounded 1c"',
          x: 754,
          y: 303,
          fillStyle: '#E97979',
          alignRight: true,
        },
      },
      {
        value: `${stats?.value?.averagePostCount?.toLocaleString()}`,
        style: {
          font: 'bold 32px "M PLUS Rounded 1c"',
          x: 1043,
          y: 303,
          fillStyle: '#E97979',
          alignRight: true,
        },
      },
      {
        value: `${stats?.value?.powerRank} ${stats?.value?.power?.toLocaleString()}`,
        style: {
          font: 'bold 32px "M PLUS Rounded 1c"',
          x: 670,
          y: 419,
          fillStyle: '#E97979',
          alignRight: true,
        },
      },
      {
        value: `https://${host}/@${$i?.username}`,
        style: {
          font: 'bold 24px "M PLUS Rounded 1c"',
          x: 1242,
          y: 610,
          fillStyle: '#6E6E6E',
          alignRight: true,
        },
      },
    ],
  },
}));

const currentTemplate = ref('default'); // 初期テンプレートを設定
const canvasSettings = ref(canvasTemplates[currentTemplate.value]); // 初期設定を適用

function switchCanvasTemplate() {
  canvasSettings.value = canvasTemplates[currentTemplate.value];
  initCanvas();
}

const bg = new Image();
bg.crossOrigin = 'anonymous';
const avatar = new Image();

function drawText(ctx: CanvasRenderingContext2D, text: string, style: TextStyle) {
  if (text.includes("undefined")) return;
	ctx.font = style.font;
  ctx.fillStyle = style.fillStyle;
	ctx.textBaseline = "top";

  if (style.alignRight) {
    // 右揃えの場合、テキストの右端を基準に描画
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, style.x - textWidth, style.y);
  } else {
    // 左揃えの場合、指定されたX座標から描画
    ctx.fillText(text, style.x, style.y);
  }
}

async function initCanvas() {
	if (!stats) return
	//設定を再読み込み
	canvasSettings.value = canvasTemplates[currentTemplate.value];

  const canvas = canvasEl.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvasLoading.value = true;

  const { backgroundImage, avatarShape, avatarPosition, avatarSize, nameStyle, embeddedValues } = canvasSettings.value;

  function loadBg() {
    return new Promise<void>((resolve) => {
      bg.addEventListener('load', () => {                                 
        canvas!.width = backgroundImage.size.width;
        canvas!.height = backgroundImage.size.height;
        ctx!.drawImage(bg, 0, 0, backgroundImage.size.width, backgroundImage.size.height);
        resolve();
      });
      bg.src = backgroundImage.url;
    });
  }

  function loadAvatar() {
    return new Promise<void>((resolve) => {
      avatar.addEventListener('load', () => {
        if (avatarShape === 'circle') {
          ctx!.save();
          ctx!.beginPath();
          ctx!.arc(avatarPosition.x, avatarPosition.y, avatarSize.width / 2, 0, Math.PI * 2);
          ctx!.clip();
        }

        ctx!.drawImage(
          avatar,
          avatarPosition.x,
          avatarPosition.y,
          avatarSize.width,
          avatarSize.height
        );

        if (avatarShape === 'circle') ctx!.restore();
        resolve();
      });
      avatar.src = `${$i?.avatarUrl}` ?? '/static-assets/avatar.png';
    });
  }

	await document.fonts.ready;
	await document.fonts.load('bold 32px "M PLUS Rounded 1c"');

  await loadBg();
  await loadAvatar();

  // 名前の描画
  drawText(ctx, truncateName(name.value, canvasSettings.value.maxNameLength), nameStyle);

  // 埋め込む値の描画
  embeddedValues.forEach(({ value, style }) => {
    drawText(ctx, value, style);
  });

  canvasLoading.value = false;
}

function truncateName(str: string, maxLength: number) {
  let out = '';
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    len += c.match(/[^\x01-\x7E]/) ? 2 : 1;
    if (len > maxLength) break;
    out += c;
  }
  return out;
}

function applyToPreview() {
  if (canvasReady.value) {
    initCanvas();
  }
}
//#endregion

//#region export as image
const result = shallowRef<Blob | null>(null);
const resultUrl = ref<string | null>(null);

function returnToInput() {
  result.value = null;
  resultUrl.value = null;
  phase.value = 'input';

  watch(canvasEl, () => {
    initCanvas();
  }, { once: true });
}

async function generate() {
  if (!canvasEl.value) return;

  await initCanvas();

  canvasEl.value.toBlob(blob => {
    if (!blob) return;
    result.value = blob;
    const url = URL.createObjectURL(blob);
    resultUrl.value = url;

    phase.value = 'share';
  }, 'image/png');
}

function postToX() {
  const url = new URL('https://x.com/intent/tweet');
  url.searchParams.set('text', i18n.t("_profileCardGen.shareTextForX", { url: `https://${host}/@${$i?.username}` }));
  url.searchParams.set('url', '');

  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function download() {
  if (!result.value) return;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(result.value);
  a.download = `profile-card-${Date.now()}.png`;
  a.click();
  a.remove();
}

function canFileShareAvailable() {
	const file = result.value ? new File([result.value], `profile-card-${Date.now()}.png`) : undefined;
	return navigator.canShare({
		text: i18n.ts._profileCardGen.shareText,
		url: `https://${host}/@${$i?.username}`,
		files: file && navigator.canShare({files: [file]}) ? [file] : undefined,
	})
}

function shareEtc() {
	const file = result.value ? new File([result.value], `profile-card-${Date.now()}.png`) : undefined;
	navigator.share({
		text: i18n.ts._profileCardGen.shareText,
		url: `https://${host}/@${$i?.username}`,
		files: file && navigator.canShare({files: [file]}) ? [file] : undefined,
	});
}

async function note() {
  if (!result.value) return;

  const uploadPromise: Promise<Misskey.entities.DriveFile | null> = (async () => {
    const formData = new FormData();
    formData.append('file', result.value!);
    formData.append('name', `profile-card-${Date.now()}.png`);
    formData.append('isSensitive', 'false');
    formData.append('i', $i?.token);
    if (defaultStore.state.uploadFolder) {
      formData.append('folderId', defaultStore.state.uploadFolder);
    }

    const res = await window.fetch(`${apiUrl}/drive/files/create`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      return await res.json();
    }
    return null;
  })();

  os.promiseDialog(uploadPromise);

  const file = await uploadPromise;

  if (!file) return;

  os.post({
    initialText: i18n.ts._profileCardGen.shareTextForLocal,
    initialFiles: [file],
    instant: true,
  });
}
//#endregion

onMounted(() => {
	// フォントをインポート
  let style = document.getElementById("card-custom-font");
  if (!style) {
    style = document.createElement("style");
    style.id = "card-custom-font";
    document.head.appendChild(style);
		style.innerHTML = `
			@import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@100;300;400;500;700;800;900&display=swap');
		`;
  }

  if ($i) {
    os.api("users/stats", {
      userId: $i.id,
    }).then((response) => {
      stats.value = response;
      checkCanvasReady();
    });
  }

  // $i が存在するかを確認
  if ($i && stats.value) {
    checkCanvasReady();
  }
});

// $i と stats が揃ったかを確認する関数
function checkCanvasReady() {
	document.fonts.load('bold 32px "M PLUS Rounded 1c"').then(() => {
		if ($i && stats.value) {
			canvasReady.value = true;
			initCanvas();
  	}
	})
}

onDeactivated(() => {
  canvasLoading.value = true;
  result.value = null;
  resultUrl.value = null;
});
</script>

<style module lang="scss">
.transition_x_enterActive,
.transition_x_leaveActive {
	transition: opacity 0.3s cubic-bezier(0,0,.35,1), transform 0.3s cubic-bezier(0,0,.35,1);
}
.transition_x_enterFrom {
	opacity: 0;
	transform: translateX(50px);
}
.transition_x_leaveTo {
	opacity: 0;
	transform: translateX(-50px);
}

.ProfileCardGenRoot {
	container-type: inline-size;
	height: 100%;
}

.ProfileCardGenInputRoot {
	height: 100%;
	display: grid;
	grid-template-columns: 1fr 600px;
}

.ProfileCardGenPreviewRoot {
	position: relative;
	background-color: var(--bg);
	cursor: not-allowed;
}

.ProfileCardGenPreviewWrapper {
	display: flex;
	flex-direction: column;
	height: 100%;
	pointer-events: none;
	user-select: none;
	-webkit-user-drag: none;
}

.ProfileCardGenPreviewTitle {
	width: fit-content;
	flex-shrink: 0;
	padding: 0 8px;
	background-color: var(--panel);
	border-right: 1px solid var(--divider);
	border-bottom: 1px solid var(--divider);
	border-bottom-right-radius: var(--radius);
	height: 28px;
	line-height: 28px;
	box-sizing: border-box;
}

.ProfileCardGenPreviewSpinner {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
	user-select: none;
	-webkit-user-drag: none;
}

.ProfileCardGenPreviewInert {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: var(--margin);
}

.ProfileCardGenPreviewCanvas {
	width: 100%;
	height: auto;
}

.ProfileCardGenSettings {
	padding: 24px;
	overflow-y: scroll;
}

.ProfileCardGenResultRoot {
	box-sizing: border-box;
	padding: 24px;
	height: 100%;
	max-width: 700px;
	margin: 0 auto;
}

.ProfileCardGenResultHeading {
	text-align: center;
	font-size: 1.2em;
}

.ProfileCardGenResultHeadingIcon {
	margin: 0 auto;
	background-color: var(--accentedBg);
	color: var(--accent);
	text-align: center;
	height: 64px;
	width: 64px;
	font-size: 24px;
	line-height: 64px;
	border-radius: 50%;
}

.ProfileCardGenResultDescription {
	text-align: center;
	white-space: pre-wrap;
}

.ProfileCardGenResultWrapper {
	width: 100%;
	height: 100%;
}

.ProfileCardGenResultImage {
	width: 100%;
	height: auto;
	min-height: 0;
	object-fit: contain;
}

.ProfileCardGenResultWarning {
	text-align: center;
	font-size: 0.8em;
	opacity: 0.7;
	white-space: pre-wrap;
}

@container (max-width: 800px) {
	.ProfileCardGenInputRoot {
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 1fr;
	}
}

.caption {
	font-size: 0.85em;
	padding: 0.5rem 0 0 0;
	color: var(--fgTransparentWeak);

	&:empty {
		display: none;
	}
}
</style>
