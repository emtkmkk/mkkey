<template>
  <MkModalWindow ref="dialogEl" @close="cancel()" @closed="$emit('closed')" >
    <template #header>:{{ _emoji.name }}:</template>
    <template #default>
      <MkSpacer>
        <div style="display: flex; flex-direction: column; gap: 1em;">
          <div :class="$style.emojiImgWrapper">
            <MkEmoji :emoji="`:${_emoji.name}${_emoji.host ? '@' + _emoji.host : ''}:`" :normal="true" style="height: 100%;"></MkEmoji>
          </div>
          <MkKeyValue>
            <template #key>{{ i18n.ts.name }}</template>
            <template #value>{{ _emoji.name }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="_emoji.host">
            <template #key>{{ i18n.ts.host }}</template>
            <template #value>{{ _emoji.host }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="_emoji.createdAt">
            <template #key>{{ i18n.ts.createdAt }}</template>
            <template #value>
              <MkTime :time="_emoji.createdAt" mode="relative"/>
            </template>
          </MkKeyValue>
          <MkKeyValue v-if="_emoji.updatedAt">
            <template #key>{{ i18n.ts.updatedAt }}</template>
            <template #value>
              <MkTime :time="_emoji.updatedAt" mode="relative"/>
            </template>
          </MkKeyValue>
          <MkKeyValue v-if="_emoji.aliases.length > 0">
            <template #key>{{ i18n.ts.tags }}</template>
            <template #value>
              <div v-if="_emoji.aliases.length === 0">{{ i18n.ts.none }}</div>
              <div v-else :class="$style.aliases">
                <span v-for="alias in _emoji.aliases" :key="alias" :class="$style.alias">
                  {{ alias }}
                </span>
              </div>
            </template>
          </MkKeyValue>
          <MkKeyValue v-if="_emoji.category">
            <template #key>{{ i18n.ts.category }}</template>
            <template #value>{{ _emoji.category ?? i18n.ts.none }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="!_emoji.license">
            <template #key>{{ i18n.ts.license }}</template>
            <template #value>{{ _emoji.license ?? i18n.ts.none }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="licenseDetail.description">
            <template #key>{{ i18n.ts.emojiDescription }}</template>
            <template #value>
							{{ licenseDetail.description }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="licenseDetail.author">
            <template #key>{{ i18n.ts.emojiAuthor }}</template>
            <template #value>
							{{ licenseDetail.author }}</template>
          </MkKeyValue>
          <MkKeyValue>
            <template #key>{{ i18n.ts.copyPermission }}</template>
            <template #value>
							<i 
							class="ph-bold ph-lg" 
							:class="{
								'ph-check': licenseDetail.copyPermission == 'allow',
								[$style.allow]: licenseDetail.copyPermission == 'allow',
								'ph-warning': licenseDetail.copyPermission == 'conditional',
								[$style.conditional]: licenseDetail.copyPermission == 'conditional',
								'ph-prohibit': licenseDetail.copyPermission == 'deny',
								[$style.deny]: licenseDetail.copyPermission == 'deny',
								'ph-question': licenseDetail.copyPermission == 'none',
							}"></i>
							{{ i18n.ts._copyPermission[licenseDetail.copyPermission] ?? licenseDetail.copyPermission }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="licenseDetail.license">
            <template #key>{{ i18n.ts.license }}</template>
            <template #value>
							{{ licenseDetail.license }}</template>
          </MkKeyValue>
          <MkKeyValue v-if="licenseDetail.usageInfo">
            <template #key>{{ i18n.ts.usageInfo }}</template>
            <template #value>
							{{ licenseDetail.usageInfo }}</template>
          </MkKeyValue>
          <MkKeyValue :copy="_emoji.url">
            <template #key>{{ i18n.ts.emojiUrl }}</template>
            <template #value>
              <a :href="_emoji.url" target="_blank">{{ _emoji.url }}</a>
            </template>
          </MkKeyValue>
          <MkKeyValue v-if="licenseDetail.isBasedOnUrl" :copy="licenseDetail.isBasedOnUrl">
            <template #key>{{ i18n.ts.isBasedOnUrl }}</template>
            <template #value>
              <a :href="licenseDetail.isBasedOnUrl" target="_blank">{{ licenseDetail.isBasedOnUrl }}</a>
            </template>
          </MkKeyValue>
					<br />
          <a :href="`https://docs.google.com/forms/d/e/1FAIpQLSepnPHEIhGUBdOQzP0Dzfs7xO75-y010W9WbdHHax-rnHuHgA/viewform?usp=pp_url&entry.1857072831=${emojiName}`" target="_blank">{{ "編集申請はこちらから" }}</a>
        </div>
      </MkSpacer>
    </template>
  </MkModalWindow>
</template>

<script lang="ts" setup>
import * as Misskey from 'calckey-js';
import { defineProps, shallowRef, unref } from 'vue';
import { i18n } from '@/i18n.js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import * as config from "@/config";
import * as os from "@/os";
const props = defineProps<{
  emoji: any,
}>();
const emit = defineEmits<{
	(ev: 'ok', cropped: Misskey.entities.DriveFile): void;
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();
const dialogEl = shallowRef<InstanceType<typeof MkModalWindow>>();
const cancel = () => {
	emit('cancel');
	dialogEl.value!.close();
};

const emojiHost = typeof props.emoji === "string" ? props.emoji.split("@")?.[1]?.replaceAll(":", "") : undefined;

const _emoji = typeof props.emoji === "string"
			? (await os.apiGet('emoji', {
							name: props.emoji.split("@")?.[0]?.replaceAll(":", ""),
							...(emojiHost ? {host: emojiHost} : {})
			}))
			: unref(props.emoji);

const licenseDetail = !_emoji.host && _emoji.license === "文字だけ" 
? {
	copyPermission: "allow",
	license: "CC0 1.0 Universal",
	author: config.host,
} : {
	copyPermission: _emoji.license?.includes("コピー可否 : ") ? /コピー可否 : (\w+)(,|$)/.exec(_emoji.license)?.[1] ?? "none" : "none",
	license: _emoji.license?.includes("ライセンス : ") ? /ライセンス : ([^,:]+)(,|$)/.exec(_emoji.license)?.[1] ?? null : null,
	usageInfo: _emoji.license?.includes("使用情報 : ") ? /使用情報 : ([^,:]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
	author: _emoji.license?.includes("作者 : ") ? /作者 : ([^,:]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
	description: _emoji.license?.includes("説明 : ") ? /説明 : ([^,:]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
	isBasedOnUrl: _emoji.license?.includes("コピー元 : ") ? /コピー元 : ([^,:]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
}

</script>

<style lang="scss" module>
.emojiImgWrapper {
  max-width: 100%;
  height: 40cqh;
  background-image: repeating-linear-gradient(45deg, transparent, transparent 8px, var(--X5) 8px, var(--X5) 14px);
  border-radius: var(--radius);
  margin: auto;
  overflow-y: hidden;
}

.aliases {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.alias {
  display: inline-block;
  padding: 3px 10px;
  background-color: var(--X5);
  border: solid 1px var(--divider);
  border-radius: var(--radius);
}

.allow {
	color: var(--success);
}
.conditional {
	color: var(--warn);
}
.deny {
	color: var(--error);
}
</style>
