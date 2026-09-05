<template>
  <div class="mk-uploader _acrylic" :class="{ 'all-no-img': allUploads.every(ctx => !ctx.img) }" :style="{ zIndex }">
    <ol v-if="allUploads.length > 0">
      <li v-for="ctx in allUploads" :key="ctx.id" :class="{ 'no-img': !ctx.img, 'no-progress': ctx.progressValue === undefined || ctx.progressMax === undefined }">
        <div
          v-if="ctx.img"
          class="img"
          :style="{ backgroundImage: `url(${ctx.img})` }"
        ></div>
        <div class="top">
          <p class="name">
            <i class="ph-cloud-arrow-up ph-bold ph-lg fa-pulse"></i>
            {{ ctx.name }}
          </p>
          <p class="status">
            <span
              v-if="ctx.phase === 'processing'"
              class="phase"
            >{{ serverStatusText(ctx) }}<MkEllipsis /></span>
            <span
              v-else-if="ctx.phase === 'compressing'"
              class="phase"
            >{{ i18n.ts.compressing }}<MkEllipsis /></span>
            <span
              v-else-if="ctx.progressValue === undefined"
              class="initing"
            >{{ i18n.ts.waiting }}<MkEllipsis /></span>
            <span v-if="ctx.phase !== 'processing' && ctx.phase !== 'compressing' && ctx.progressValue !== undefined" class="kb"
            >{{
              String(Math.floor(ctx.progressValue / 1024))
                .replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")
            }}<i>KB</i> /
            {{
              String(Math.floor(ctx.progressMax / 1024))
                .replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")
            }}<i>KB</i></span>
            <!--
              NOTE: 100.0% まで出す。以前は 100% のまま待たされるのを避けるため 99.9% で
              頭打ちにしていたが、送信完了と同時にサーバ側の処理段階の表示へ切り替わるので、
              100% で止まって見えることはない。
            -->
            <span
              v-if="ctx.phase !== 'processing' && ctx.phase !== 'compressing' && ctx.progressValue !== undefined"
              class="percentage"
            >{{
              (
                Math.floor(
                  (ctx.progressValue / ctx.progressMax) * 1000
                ) / 10
              ).toFixed(1)
            }}</span>
          </p>
        </div>
        <progress
          v-if="ctx.progressValue !== undefined && ctx.progressMax !== undefined"
          :value="barValue(ctx)"
          :max="barMax(ctx)"
          :class="{
            initing: ctx.progressValue === undefined,
            waiting: isIndeterminate(ctx),
          }"
        ></progress>
      </li>
    </ol>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import * as os from "@/os";
import { uploads } from "@/scripts/upload";
import { i18n } from "@/i18n";

const zIndex = os.claimZIndex("high");

const queueDatas = ref(os.queueDatas.value);

// サーバ処理待ちの経過秒を出すための現在時刻。updateQueueDatas と同じ間隔で更新する。
const now = ref(Date.now());

const updateQueueDatas = () => {
  now.value = Date.now();
  queueDatas.value = os.queueDatas.value.filter((x) => {
    if (x.date instanceof Date) {
      return Date.now() - x.date.getTime() > 1950;
    }
    return false;
  });
};

const queueDataUploads = computed(() => {
  return queueDatas.value.map((data) => ({
    id: data.id,
    name: data.comment || data.endpoint,
    progressValue: undefined,
    progressMax: undefined,
    img: null,
    phase: undefined,
    processingSince: null,
  }));
});

/**
 * サーバ処理待ちに入ってからの経過時間。
 * 進捗が止まって見える区間で、止まっているのか進んでいるのかを判別できるようにする。
 */
const elapsedText = (ctx: { processingSince?: number | null }) => {
  if (!ctx.processingSince) return "";
  const seconds = Math.floor((now.value - ctx.processingSince) / 1000);
  return seconds > 0 ? "(" + seconds + "s)" : "";
};

/** サーバ側の処理段階のラベル。 */
const stageLabels: Record<string, string> = {
  downloading: i18n.ts.driveProcessDownloading,
  analyzing: i18n.ts.driveProcessAnalyzing,
  detecting: i18n.ts.driveProcessDetecting,
  generating: i18n.ts.driveProcessGenerating,
  storing: i18n.ts.driveProcessStoring,
  saving: i18n.ts.driveProcessSaving,
};

/**
 * 送信完了後に出す「サーバが今やっていること」の文言。
 * 段階がまだ届いていない間は汎用の表記にフォールバックする。
 */
const serverStatusText = (ctx: {
  stage?: string | null;
  stageProgress?: number | null;
  processingSince?: number | null;
}) => {
  const label = (ctx.stage && stageLabels[ctx.stage]) || i18n.ts.processing;
  const progress = ctx.stageProgress != null ? ` ${ctx.stageProgress}%` : "";
  const elapsed = elapsedText(ctx);
  return `${label}${progress}${elapsed ? ` ${elapsed}` : ""}`;
};

/** サーバ処理中で段階進捗が取れないときは、進捗バーを不定表示にする。 */
const isIndeterminate = (ctx: { phase?: string; stageProgress?: number | null }) =>
  ctx.phase === "processing" && ctx.stageProgress == null;

const barValue = (ctx: {
  phase?: string;
  stageProgress?: number | null;
  progressValue?: number;
}) =>
  ctx.phase === "processing" && ctx.stageProgress != null
    ? ctx.stageProgress
    : ctx.progressValue || 0;

const barMax = (ctx: {
  phase?: string;
  stageProgress?: number | null;
  progressMax?: number;
}) =>
  ctx.phase === "processing" && ctx.stageProgress != null
    ? 100
    : ctx.progressMax || 0;

const allUploads = computed(() => {
  return [...queueDataUploads.value, ...uploads.value];
});

let intervalId: string | number | NodeJS.Timer | undefined;

onMounted(() => {
  updateQueueDatas();
  intervalId = setInterval(updateQueueDatas, 500);
});

onUnmounted(() => {
  if (intervalId !== undefined) clearInterval(intervalId);
  intervalId = undefined;
});
</script>

<style lang="scss" scoped>
.mk-uploader {
  position: fixed;
  right: 1rem;
  width: 18.75rem;
  top: 2rem;
  padding: 1rem 1.25rem;
  pointer-events: none;
  box-shadow: 0 0.25rem 1rem rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
}
.mk-uploader.all-no-img {
  width: 18.75rem;
}
.mk-uploader:empty {
  display: none;
}
.mk-uploader > ol {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mk-uploader > ol > li {
  display: grid;
  margin: 0.5rem 0 0 0;
  padding: 0;
  height: 2.5rem;
  width: 100%;
  border-top: solid 0.5rem transparent;
  grid-template-columns: 2.25rem calc(100% - 2.75rem);
  grid-template-rows: 1fr auto;
  column-gap: 0.5rem;
  box-sizing: content-box;
}
.mk-uploader > ol > li.no-progress {
  height: 2rem;
  grid-template-rows: 1fr;
}
.mk-uploader > ol > li.no-img {
  grid-template-columns: calc(100% - 0.5rem);
  width: calc(100% - 2.25rem);
}
.mk-uploader > ol > li:first-child {
  margin: 0;
  box-shadow: none;
  border-top: none;
}
.mk-uploader > ol > li > .img {
  display: block;
  background-size: contain;
	background-repeat: no-repeat;
  background-position: center center;
  grid-column: 1/2;
  grid-row: 1/3;
}
.mk-uploader > ol > li.no-img > .img {
  display: none;
}
.mk-uploader > ol > li > .top {
  display: flex;
  grid-column: 2/3;
  grid-row: 1/2;
}
.mk-uploader > ol > li.no-img > .top {
  grid-column: 1/2;
}
.mk-uploader > ol > li > .top > .name {
  display: block;
  padding: 0 0.5rem 0 0;
  margin: 0;
  font-size: 0.8em;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  flex-shrink: 1;
}
.mk-uploader > ol > li > .top > .name > i {
  margin-right: 0.25rem;
}
.mk-uploader > ol > li > .top > .status {
  display: block;
  margin: 0 0 0 auto;
  padding: 0;
  font-size: 0.8em;
  flex-shrink: 0;
}
.mk-uploader > ol > li > .top > .status > .initing {
}
.mk-uploader > ol > li > .top > .status > .kb {
}
.mk-uploader > ol > li > .top > .status > .percentage {
  display: inline-block;
  width: 3rem;
  text-align: right;
}
.mk-uploader > ol > li > .top > .status > .percentage:after {
  content: "%";
}
.mk-uploader > ol > li > progress {
  display: block;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  overflow: hidden;
  grid-column: 2/3;
  grid-row: 2/3;
  z-index: 2;
  width: 100%;
  height: 0.5rem;
}
.mk-uploader > ol > li.no-progress > progress {
  display: none;
}
.mk-uploader > ol > li > progress[hidden] {
  display: none;
}
.mk-uploader > ol > li > progress::-webkit-progress-value {
  background: var(--accent);
}
.mk-uploader > ol > li > progress::-webkit-progress-bar {
  background: transparent;
}
/* 送信完了後（サーバ処理待ち）は、固まっていないことが分かるように点滅させる */
.mk-uploader > ol > li > progress.waiting::-webkit-progress-value {
  animation: mk-uploader-pulse 1.2s ease-in-out infinite;
}
@keyframes mk-uploader-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
