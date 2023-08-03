<template>
	<img
		v-if="isCustom && urlRaw.length > errorCnt"
		class="mk-emoji"
		:key="emoji + '-' + errorCnt"
		:class="{ normal, noStyle, bigCustom, custom : !bigCustom }"
		:src="url"
		:alt="alt"
		:title="alt"
		decoding="async"
		@error="emit('loaderror', emoji); errorCnt = errorCnt + 1;"
	/>
	<img
		v-else-if="char && !useOsNativeEmojis"
		class="mk-emoji"
		:src="url"
		:alt="alt"
		:title="alt"
		decoding="async"
	/>
	<span v-else-if="char && useOsNativeEmojis">{{ char }}</span>
	<img
		v-else-if="isCustom && urlRaw.length <= errorCnt && !isPicker && emojiHost && !errorAlt"
		class="mk-emoji emoji-ghost"
		:key="emoji + '-alt'"
		:class="{ normal, noStyle, bigCustom, custom : !bigCustom }"
		:src="altimgUrl"
		:alt="alt"
		:title="alt"
		decoding="async"
		@error="errorAlt = true"
	/>
	<span v-else>{{ customEmojiName && !isReaction ? `:${customEmojiName}:` : emoji }}</span>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { CustomEmoji } from "calckey-js/built/entities";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import { char2filePath } from "@/scripts/twemoji-base";
import { defaultStore } from "@/store";
import { instance } from "@/instance";

const props = defineProps<{
	emoji: string;
	normal?: boolean;
	noStyle?: boolean;
	customEmojis?: CustomEmoji[];
	isReaction?: boolean;
	noteHost?: string;
	isPicker?: boolean;
}>();

const isCustom = computed(() => props.emoji.startsWith(":"));
const bigCustom = computed(() => defaultStore.state.useBigCustom);
const char = computed(() => (isCustom.value ? null : props.emoji));
const hostmatch = props.emoji ? props.emoji.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/) : undefined;
const useOsNativeEmojis = computed(
	() => defaultStore.state.useOsNativeEmojis && !props.isReaction
);
const errorCnt = ref(0);
const errorEmoji = ref(false);
const errorAlt = ref(false);
const propsCustomEmojisStr = computed(() => props.customEmojis?.map((x) => x.name + "@" + (x.host ?? ".")));
const ce = computed(() => props.customEmojis ?? instance.emojis ?? []);
const ace = computed(() => 
	[
		...(instance.allEmojis.filter(x => !propsCustomEmojisStr.value?.includes(x.name + "@" + (x.host ?? "."))) ?? []),
		...(props.customEmojis ?? []),
	]
);
const customEmoji = computed(() =>
	isCustom.value
		? hostmatch?.[2]
			? ace.value.find(
					(x) => x.name === hostmatch?.[1] && x.host === hostmatch?.[2]
			)
			: props.noteHost
				? ace.value?.find(
					(x) => x.name === props.emoji.substr(1, props.emoji.length - 2) && x.host === props.noteHost
				)
				: ce.value.find(
						(x) => x.name === props.emoji.substr(1, props.emoji.length - 2)
				) ?? (props.noteHost ? ace?.value?.find(
					(x) => x.name === props.emoji.substr(1, props.emoji.length - 2) && x.host === props.noteHost
				) : null)
		: null
);

const customEmojiName = computed(() => {
	return customEmoji.value?.name || hostmatch?.[1] || props.emoji.substr(1, props.emoji.length - 2) || null;
});

const emojiHost = computed(() => {
	return customEmoji.value?.host || hostmatch?.[2] || props.noteHost || null;
});

const urlRaw = computed(() => {
	const urlArr = [];
	if(customEmoji.value.url) urlArr.push(customEmoji.value.url);
	urlArr.push(
		emojiHost.value
			? `/emoji/${customEmojiName.value}@${emojiHost.value}.webp` 
			: `/emoji/${customEmojiName.value}.webp`
	)
	return urlArr
});

const url = computed(() => {
	if (char.value) {
		return char2filePath(char.value);
	} else {
		return urlRaw.value.length > errorCnt.value ?
			defaultStore.state.disableShowingAnimatedImages
					? getStaticImageUrl(urlRaw.value[errorCnt.value])
					: urlRaw.value[errorCnt.value]
			: "";
	}
});

const altimgUrl = computed(() => {
		return emojiHost.value ? 
			defaultStore.state.disableShowingAnimatedImages
				? getStaticImageUrl(`https://${emojiHost.value}/emoji/${customEmojiName.value}.webp`)
				: `https://${emojiHost.value}/emoji/${customEmojiName.value}.webp`
			: "";
});

const alt = computed(() =>
	customEmoji.value ? `:${customEmoji.value.name}${hostmatch?.[2] ? "@" + hostmatch?.[2] : (props.noteHost ?? "")}:` : char.value
);

</script>

<style lang="scss" scoped>
.mk-emoji {
	height: 1.25em;
	vertical-align: -0.25em;

	&.custom {
		height: 1.4em;
		max-width: 100%;
		vertical-align: top;
		object-fit: contain;
		transition: transform 0.2s ease;

		&:hover {
			transform: scale(1.2);
		}

		&.normal {
			height: 1.25em;
			vertical-align: -0.25em;

			&:hover {
				transform: none;
			}
		}
	}
	
	&.emoji-ghost {
		opacity: 0.8;
	}
	
	&.bigCustom {
		height: 2.5em;
		max-width: 100%;
		vertical-align: middle;
		object-fit: contain;
		transition: transform 0.2s ease;

		&:hover {
			transform: scale(1.2);
		}

		&.normal {
			height: 1.25em;
			vertical-align: -0.25em;

			&:hover {
				transform: none;
			}
		}
	}

	&.noStyle {
		height: auto !important;
	}
}
</style>
