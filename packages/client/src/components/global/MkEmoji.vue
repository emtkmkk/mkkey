<template>
	<img
		v-if="customEmoji"
		class="mk-emoji"
		:class="{ normal, noStyle, bigCustom, custom : !bigCustom }"
		:src="url"
		:alt="alt"
		:title="alt"
		decoding="async"
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
	<span v-else>{{ emoji }}</span>
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
}>();

const isCustom = computed(() => props.emoji.startsWith(":"));
const bigCustom = computed(() => defaultStore.state.useBigCustom);
const char = computed(() => (isCustom.value ? null : props.emoji));
const hostmatch = props.emoji && !props.customEmojis ? props.emoji.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/) : undefined;
const useOsNativeEmojis = computed(
	() => defaultStore.state.useOsNativeEmojis && !props.isReaction
);
const ce = computed(() => props.customEmojis ?? instance.emojis ?? []);
const ace = computed(() => 
	[
		...(instance.allEmojis ?? []),
		...(props.customEmojis ?? []),
	]
);
const customEmoji = computed(() =>
	isCustom.value
		? hostmatch?.[2]
			? ace.value.find(
					(x) => x.name === hostmatch?.[1] && x.host === hostmatch?.[2]
			)
			: props.noteHost && !props.customEmojis
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
	return customEmoji.value.name || hostmatch?.[1] || props.emoji.substr(1, props.emoji.length - 2) || null;
}

const emojiHost = computed(() => {
	return customEmoji.value.host || hostmatch?.[2] || props.noteHost || null;
}

const urlRaw = computed(() => {
	return customEmoji.value.url 
		? customEmoji.value.url 
		: emojiHost.value
			? `/emoji/${customEmojiName.value}@${emojiHost.value}.webp` 
			: `/emoji/${customEmojiName.value}.webp`;
}

const url = computed(() => {
	if (char.value) {
		return char2filePath(char.value);
	} else {
		return defaultStore.state.disableShowingAnimatedImages
				? getStaticImageUrl(urlRaw.value)
				: urlRaw.value;
	}
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
