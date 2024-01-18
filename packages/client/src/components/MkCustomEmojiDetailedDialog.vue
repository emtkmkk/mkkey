<template>
  <XModalWindow ref="dialog" @click="cancel()" @close="cancel()" @closed="$emit('closed')" >
    <template #header>{{ _emoji ? `:${_emoji.name}${_emoji.host ? '@' + _emoji.host : ''}:` : "" }}</template>
		<MkSpacer>
			<div v-if="_emoji && Object.keys(licenseDetail).filter((x) => licenseDetail[x]).length >= 1" style="display: flex; flex-direction: column; gap: 1em;">
				<div :class="$style.emojiImgWrapper">
					<MkEmoji :emoji="`:${_emoji.name}${_emoji.host ? '@' + _emoji.host : ''}:`" :normal="true" style="height: 100%;"></MkEmoji>
				</div>
				<MkKeyValue :copy="`:${_emoji.name}${_emoji.host ? '@' + _emoji.host : ''}:`">
					<template #key>{{ i18n.ts.name }}</template>
					<template #value>{{ _emoji.name }}</template>
				</MkKeyValue>
				<MkKeyValue v-if="_emoji.host">
					<template #key>{{ i18n.ts.host }}</template>
					<template #value>{{ _emoji.host }}</template>
				</MkKeyValue>
				<MkKeyValue v-if="_emoji.aliases.length > 0">
					<template #key>{{ i18n.ts.tags }}</template>
					<template #value>
						<div v-if="_emoji.aliases.filter((x) => x.trim()).length === 0">{{ i18n.ts.none }}</div>
						<div v-else :class="$style.aliases">
							<span v-for="alias in _emoji.aliases.filter((x) => x.trim())" :key="alias" :class="$style.alias">
								{{ alias }}
							</span>
						</div>
					</template>
				</MkKeyValue>
				<MkKeyValue v-if="_emoji.category">
					<template #key>{{ i18n.ts.category }}</template>
					<template #value>{{ _emoji.category ?? i18n.ts.none }}</template>
				</MkKeyValue>
				<MkKeyValue v-if="licenseDetail.description">
					<template #key>{{ i18n.ts.emojiDescription }}</template>
					<template #value>
						<Mfm :text="licenseDetail.description" /></template>
				</MkKeyValue>
				<MkKeyValue v-if="licenseDetail.author">
					<template #key>{{ i18n.ts.emojiAuthor }}</template>
					<template #value>
						<Mfm :text="licenseDetail.author" /></template>
				</MkKeyValue>
				<MkKeyValue v-if="!_emoji.host || licenseDetail.copyPermission !== 'none'">
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
						<Mfm :text="licenseDetail.license" />
					</template>
				</MkKeyValue>
				<MkKeyValue v-if="licenseDetail.usageInfo">
					<template #key>{{ i18n.ts.usageInfo }}</template>
					<template #value>
						<Mfm :text="licenseDetail.usageInfo" />
					</template>
				</MkKeyValue>
				<MkKeyValue v-if="!_emoji.license || licenseText">
					<template #key>{{ Object.keys(licenseDetail).filter((x) => licenseDetail[x]).length < 2 ? i18n.ts.license : i18n.ts.licenseText }}</template>
					<template #value>
						<Mfm :text="licenseText ?? i18n.ts.none" />
					</template>
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
				<MkKeyValue :copy="_emoji.url">
					<template #key>{{ i18n.ts.emojiUrl }}</template>
					<template #value>
						<MkLink :url="_emoji.url" target="_blank">{{ _emoji.url }}</MkLink>
					</template>
				</MkKeyValue>
				<MkKeyValue v-if="licenseDetail.isBasedOnUrl" :copy="licenseDetail.isBasedOnUrl">
					<template #key>{{ i18n.ts.isBasedOnUrl }}</template>
					<template #value>
						<MkLink :url="licenseDetail.isBasedOnUrl" target="_blank">{{ licenseDetail.isBasedOnUrl }}</MkLink>
					</template>
				</MkKeyValue>
				<MkLink v-if="$i && !_emoji.host" :url="`https://docs.google.com/forms/d/e/1FAIpQLSepnPHEIhGUBdOQzP0Dzfs7xO75-y010W9WbdHHax-rnHuHgA/viewform?usp=pp_url&entry.1857072831=${_emoji.name}`" target="_blank">{{ "編集申請はこちらから" }}</MkLink>
			</div>
		</MkSpacer>
  </XModalWindow>
</template>

<script lang="ts" setup>
import * as Misskey from 'calckey-js';
import { defineProps, onMounted } from 'vue';
import { i18n } from '@/i18n.js';
import XModalWindow from "@/components/MkModalWindow.vue";
import MkKeyValue from '@/components/MkKeyValue.vue';
import MkLink from '@/components/MkLink.vue';
import * as config from "@/config";
import * as os from "@/os";
import { $i } from "@/account";
const props = defineProps<{
  emoji: any,
}>();
const emit = defineEmits<{
	(ev: 'ok', cropped: Misskey.entities.DriveFile): void;
	(ev: 'cancel'): void;
	(ev: 'closed'): void;
}>();
const dialog = $ref<InstanceType<typeof XModalWindow>>();
const cancel = () => {
	console.log('cancel');
	emit('cancel');
	dialog.close();
};

const fetchData = async () => {
  const emojiHost = props.emoji.split("@")?.[1]?.replaceAll(":","");

  return await os.apiGet('emoji', {
        name: props.emoji.split("@")?.[0]?.replaceAll(":",""),
        ...(emojiHost ? { host: emojiHost } : {})
      });
};

let _emoji = $ref<object | undefined>(undefined);

let licenseDetail = $ref<object | undefined>(undefined);

let licenseText = $ref<string | undefined>("");

onMounted(async () => {
	_emoji = typeof props.emoji === "string" ? await fetchData() : props.emoji

	licenseDetail = !_emoji.host && _emoji.license === "文字だけ" ? {
		copyPermission: "allow",
		license: "CC0 1.0 Universal",
		author: config.host,
	} : {
		copyPermission: _emoji.license?.includes("コピー可否 : ") ? /コピー可否 : (\w+)(,|$)/.exec(_emoji.license)?.[1] ?? "none" : "none",
		license: _emoji.license?.includes("ライセンス : ") ? /ライセンス : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ?? null : null,
		usageInfo: _emoji.license?.includes("使用情報 : ") ? /使用情報 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
		author: _emoji.license?.includes("作者 : ") ? /作者 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
		description: _emoji.license?.includes("説明 : ") ? /説明 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
		isBasedOnUrl: _emoji.license?.includes("コピー元 : ") ? /コピー元 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ?? undefined : undefined,
	}

	licenseText = _emoji.license?.replaceAll(/(コピー可否|ライセンス|使用情報|作者|説明|コピー元) : ([^,]+)(,|$)/g, "").trim();
})

</script>

<style lang="scss" module>
.emojiImgWrapper {
  max-width: 100%;
  height: 30cqh;
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
  word-break: break-all;
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
.link {
	color: var(--link);
}
</style>
