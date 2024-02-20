<template>
	<MkSpacer :content-max="600" :margin-min="20">
		<div
			v-if="
				_emoji &&
				Object.keys(licenseDetail).filter((x) => licenseDetail[x])
					.length >= 1
			"
			style="display: flex; flex-direction: column; gap: 1em"
		>
			<div :class="$style.emojiImgWrapper">
				<MkEmoji
					:emoji="`:${_emoji.name}${
						_emoji.host ? '@' + _emoji.host : ''
					}:`"
					:normal="true"
					style="height: 100%"
				></MkEmoji>
			</div>
			<MkKeyValue
				:copy="`:${_emoji.name}${
					_emoji.host ? '@' + _emoji.host : ''
				}:`"
			>
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
					<div
						v-if="
							_emoji.aliases.filter((x) => x.trim()).length === 0
						"
					>
						{{ i18n.ts.none }}
					</div>
					<div v-else :class="$style.aliases">
						<span
							v-for="alias in _emoji.aliases.filter((x) =>
								x.trim()
							)"
							:key="alias"
							:class="$style.alias"
						>
							{{ alias }}
						</span>
					</div>
				</template>
			</MkKeyValue>
			<MkKeyValue v-if="_emoji.category">
				<template #key>{{ i18n.ts.category }}</template>
				<template #value>{{
					_emoji.category ?? i18n.ts.none
				}}</template>
			</MkKeyValue>
			<MkKeyValue v-if="licenseDetail.description">
				<template #key>{{ i18n.ts.emojiDescription }}</template>
				<template #value>
					<Mfm :text="licenseDetail.description"
				/></template>
			</MkKeyValue>
			<MkKeyValue v-if="licenseDetail.author">
				<template #key>{{ i18n.ts.emojiAuthor }}</template>
				<template #value>
					<Mfm :text="licenseDetail.author"
				/></template>
			</MkKeyValue>
			<MkKeyValue
				v-if="!_emoji.host || licenseDetail.copyPermission !== 'none'"
			>
				<template #key>{{ i18n.ts.copyPermission }}</template>
				<template #value>
					<i
						class="ph-bold ph-lg"
						:class="{
							'ph-check': licenseDetail.copyPermission == 'allow',
							[$style.allow]:
								licenseDetail.copyPermission == 'allow',
							'ph-warning':
								licenseDetail.copyPermission == 'conditional',
							[$style.conditional]:
								licenseDetail.copyPermission == 'conditional',
							'ph-prohibit':
								licenseDetail.copyPermission == 'deny',
							[$style.deny]:
								licenseDetail.copyPermission == 'deny',
							'ph-question':
								licenseDetail.copyPermission == 'none',
						}"
					></i>
					{{
						i18n.ts._copyPermission[licenseDetail.copyPermission] ??
						licenseDetail.copyPermission
					}}</template
				>
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
				<template #key>{{
					Object.keys(licenseDetail).filter((x) => licenseDetail[x])
						.length < 2
						? i18n.ts.license
						: i18n.ts.licenseText
				}}</template>
				<template #value>
					<Mfm :text="licenseText ?? i18n.ts.none" />
				</template>
			</MkKeyValue>
			<MkKeyValue v-if="_emoji.createdAt">
				<template #key>{{ i18n.ts.createdAt }}</template>
				<template #value>
					<MkTime :time="_emoji.createdAt" mode="relative" />
				</template>
			</MkKeyValue>
			<MkKeyValue v-if="_emoji.updatedAt">
				<template #key>{{ i18n.ts.updatedAt }}</template>
				<template #value>
					<MkTime :time="_emoji.updatedAt" mode="relative" />
				</template>
			</MkKeyValue>
			<MkKeyValue :copy="_emoji.url">
				<template #key>{{ i18n.ts.emojiUrl }}</template>
				<template #value>
					<MkLink :url="_emoji.url" target="_blank">{{
						_emoji.url
					}}</MkLink>
				</template>
			</MkKeyValue>
			<MkKeyValue
				v-if="licenseDetail.isBasedOnUrl"
				:copy="licenseDetail.isBasedOnUrl"
			>
				<template #key>{{ i18n.ts.isBasedOnUrl }}</template>
				<template #value>
					<MkLink :url="licenseDetail.isBasedOnUrl" target="_blank">{{
						licenseDetail.isBasedOnUrl
					}}</MkLink>
				</template>
			</MkKeyValue>
			<MkLink
				v-if="$i && !($i.isAdmin || $i.isModerator) && !_emoji.host"
				:url="`https://docs.google.com/forms/d/e/1FAIpQLSepnPHEIhGUBdOQzP0Dzfs7xO75-y010W9WbdHHax-rnHuHgA/viewform?usp=pp_url&entry.1857072831=${_emoji.name}`"
				target="_blank"
				>{{ "編集申請はこちらから" }}</MkLink
			>
			<MkButton
				v-if="$i && ($i.isAdmin || $i.isModerator) && !_emoji.host"
				primary
				@click="edit"
				>{{ "この絵文字を編集" }}</MkButton
			>
		</div>
		<MkError v-else-if="_emoji?.error" />
		<MkLoading v-else />
	</MkSpacer>
</template>

<script lang="ts" setup>
import * as Misskey from "calckey-js";
import { defineAsyncComponent, defineProps, onMounted } from "vue";
import { i18n } from "@/i18n.js";
import MkKeyValue from "@/components/MkKeyValue.vue";
import MkLink from "@/components/MkLink.vue";
import MkButton from "@/components/MkButton.vue";
import * as config from "@/config";
import * as os from "@/os";
import { $i } from "@/account";
const props = defineProps<{
	emoji: any;
}>();

const fetchData = async () => {
	const emojiHost = props.emoji.split("@")?.[1]?.replaceAll(":", "");

	return await os.apiGet("emoji", {
		name: props.emoji.split("@")?.[0]?.replaceAll(":", ""),
		...(emojiHost ? { host: emojiHost } : {}),
	});
};

let _emoji = $ref<object | undefined>(undefined);

let licenseDetail = $ref<object | undefined>(undefined);

let licenseText = $ref<string | undefined>("");

const load = async (emoji) => {
	_emoji = typeof emoji === "string" ? await fetchData() : emoji;

	if (!_emoji) return;

	licenseDetail =
		!_emoji.host && _emoji.license === "文字だけ"
			? {
					copyPermission: "allow",
					license: "CC0 1.0 Universal",
					author: config.host,
			  }
			: {
					copyPermission: _emoji.license?.includes("コピー可否 : ")
						? /コピー可否 : (\w+)(,|$)/.exec(_emoji.license)?.[1] ??
						  "none"
						: "none",
					license: _emoji.license?.includes("ライセンス : ")
						? /ライセンス : ([^,]+)(,|$)/.exec(
								_emoji.license
						  )?.[1] ?? null
						: null,
					usageInfo: _emoji.license?.includes("使用情報 : ")
						? /使用情報 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ??
						  undefined
						: undefined,
					author: _emoji.license?.includes("作者 : ")
						? /作者 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ??
						  undefined
						: undefined,
					description: _emoji.license?.includes("説明 : ")
						? /説明 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ??
						  undefined
						: undefined,
					isBasedOnUrl: _emoji.license?.includes("コピー元 : ")
						? /コピー元 : ([^,]+)(,|$)/.exec(_emoji.license)?.[1] ??
						  undefined
						: undefined,
			  };

	licenseText = _emoji.license
		?.replaceAll(
			/(コピー可否|ライセンス|使用情報|作者|説明|コピー元) : ([^,]+)(,|$)/g,
			""
		)
		.trim()
		.replace(/,$/, "")
		.replace(/^文字だけ$/, "");
};

const edit = () => {
	os.popup(
		defineAsyncComponent(
			() => import("@/pages/admin/emoji-edit-dialog.vue")
		),
		{
			emoji: _emoji,
		},
		{
			done: (result) => {
				load(
					`${result?.updated?.name || _emoji.name}${
						emoji.host ? "@" + emoji.host : ""
					}`
				);
			},
		},
		"closed"
	);
};

onMounted(async () => {
	await load(props.emoji);
});
</script>

<style lang="scss" module>
.emojiImgWrapper {
	max-width: 100%;
	height: 20cqh;
	background-image: repeating-linear-gradient(
		45deg,
		transparent,
		transparent 0.5rem,
		var(--X5) 0.5rem,
		var(--X5) 0.875rem
	);
	border-radius: var(--radius);
	margin: auto;
	overflow-y: hidden;
}

.aliases {
	display: flex;
	flex-wrap: wrap;
	gap: 0.1875rem;
}

.alias {
	display: inline-block;
	word-break: break-all;
	padding: 0.1875rem 0.625rem;
	background-color: var(--X5);
	border: solid 0.0625rem var(--divider);
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
