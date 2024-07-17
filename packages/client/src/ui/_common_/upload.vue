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
              v-if="ctx.progressValue === undefined"
              class="initing"
            >{{ i18n.ts.waiting }}<MkEllipsis /></span>
            <span v-if="ctx.progressValue !== undefined" class="kb"
            >{{
              String(Math.floor(ctx.progressValue / 1024))
                .replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")
            }}<i>KB</i> /
            {{
              String(Math.floor(ctx.progressMax / 1024))
                .replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,")
            }}<i>KB</i></span>
            <span
              v-if="ctx.progressValue !== undefined"
              class="percentage"
            >{{
              (
                Math.floor(
                  (ctx.progressValue / ctx.progressMax) * 999.9
                ) / 10
              ).toFixed(1)
            }}</span>
          </p>
        </div>
        <progress
          v-if="ctx.progressValue !== undefined && ctx.progressMax !== undefined"
          :value="ctx.progressValue || 0"
          :max="ctx.progressMax || 0"
          :class="{
            initing: ctx.progressValue === undefined,
            waiting:
              ctx.progressValue !== undefined &&
              ctx.progressValue === ctx.progressMax,
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

const updateQueueDatas = () => {
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
  }));
});

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
  width: calc(100% - 2.25rem);
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
</style>
