<template>
	<img
		v-if="isCustom && !isMuted && urlRaw.length > errorCnt"
		class="mk-emoji"
		:class="{ normal, noStyle, bigCustom, custom : !bigCustom }"
		:src="url"
		:title="alt"
		decoding="async"
		@click="handleImgClick"
		@error="() => {
			errorCnt = errorCnt + 1;
			if (isPicker && urlRaw.length <= errorCnt) {
				emit('loaderror', '');
			}
			if (!instance.errorEmoji) {
				instance.errorEmoji = {};
			}
			instance.errorEmoji[emoji + (noteHost ? '@' + noteHost : '')] = errorCnt;
		}"
	/>
	<img
		v-else-if="char && !useOsNativeEmojis"
		class="mk-emoji"
		:src="url"
		:title="alt"
		decoding="async"
		@click="handleImgClick"
	/>
	<span v-else-if="char && useOsNativeEmojis" @click="handleImgClick">{{ char }}</span>
	<img
		v-else-if="isCustom && !isMuted && urlRaw.length <= errorCnt && !isPicker && emojiHost && !errorAlt"
		class="mk-emoji emoji-ghost"
		:class="{ normal, noStyle, bigCustom, custom : !bigCustom }"
		:src="altimgUrl"
		:title="alt + ' (localOnly)'"
		v-tooptip="emojiHost + ' localOnly'"
		decoding="async"
		@error="() => {
			errorAlt = true;
			if (!instance.errorEmojiAlt) {
				instance.errorEmojiAlt = {};
			}
			instance.errorEmojiAlt[emoji + (noteHost ? '@' + noteHost : '')] = true;
		}"
	/>
	<span v-else>{{ isCustom && customEmojiName && !isReaction ? `:${customEmojiName}:` : emoji }}</span>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { CustomEmoji } from "calckey-js/built/entities";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import { char2filePath } from "@/scripts/twemoji-base";
import { defaultStore } from "@/store";
import { instance } from "@/instance";
import { openReactionMenu_ } from "@/scripts/reaction-menu";
import * as os from "@/os";
import * as config from "@/config";

const props = defineProps<{
	emoji: string;
	normal?: boolean;
	noStyle?: boolean;
	customEmojis?: CustomEmoji[];
	isReaction?: boolean;
	noteHost?: string;
	isPicker?: boolean;
	static?: boolean;
	nofallback?: boolean;
	noreplace?: boolean;
	reactionMenuEnabled?: boolean;
	note?: any;
}>();

const emit = defineEmits(["loaderror"]);
const replace = !props.noreplace && !props.isPicker && defaultStore.state.enableEmojiReplace && defaultStore.state.allEmojiReplace.length;
const emoji = replace ? defaultStore.state.allEmojiReplace[Math.floor(Math.random() * defaultStore.state.allEmojiReplace.length)] : props.emoji;
const isCustom = computed(() => emoji.startsWith(":"));
const bigCustom = computed(() => defaultStore.state.useBigCustom);
const char = computed(() => (isCustom.value ? null : emoji));
const hostmatch = computed(() => emoji ? emoji.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/) : undefined);
const useOsNativeEmojis = computed(
	() => defaultStore.state.useOsNativeEmojis && !props.isReaction
);
const errorCnt = ref(instance.errorEmoji?.[emoji] ?? 0);
const errorAlt = ref(instance.errorEmojiAlt?.[emoji] ?? false);
const isMuted = computed(() => {
	if (!emoji) return false;
	const reactionMuted = defaultStore.state.reactionMutedWords.map((x) => {
		return {
			name: x.replaceAll(":", "").replace("@", ""),
			exact: /^:@?\w+:$/.test(x),
			hostmute: /^:?@[\w.-]/.test(x),
		};
	})
	return reactionMuted.some(x => {
		const emojiName = emoji.replace(":", "").replace(/@[\w:\.\-]+:$/, "");
		const emojiHost = emoji.replace(/^:[\w:\.\-]+@/, "").replace(":", "");
		if (x.exact) {
			if (x.hostmute) {
				if (x.name === emojiHost) {
					emit('loaderror', '');
					return true;
				}
			} else {
				if (x.name === emojiName) {
					emit('loaderror', '');
					return true;
				}
			}
		} else {
			if (x.hostmute) {
				if (emojiHost.includes(x.name)) {
					emit('loaderror', '');
					return true;
				}
			} else {
				if (emojiName.includes(x.name)) {
					emit('loaderror', '');
					return true;
				}
			}
		}
		return false;
	});
})

const ce = computed(() => instance.emojis ?? []);
const customEmoji = computed(() => {
	if (!isCustom.value) return null;

	const name = hostmatch.value?.[1];
	let host = hostmatch.value?.[2] || (!replace ? props.noteHost : undefined);

	const matchprops = props.customEmojis?.find((x) => x.name === emoji.substr(1, emoji.length - 2) && x.url);

	if (matchprops) {
		return {...matchprops, name, host};
	} else if (host && host !== "." && host !== config.host) {
		return {name, host};
	} else {
		const cefind = ce.value.find((x) => x.name === name);
		if (cefind || props.nofallback){
			return cefind
		} else {
			emit('loaderror', '');
			// ローカル絵文字が見つからない場合、aliasesを検索
			return ce.value.find((x) => x.aliases?.some((y) => /^\w+$/.test(y) && y === name));
		}
	}
}
);

const customEmojiName = computed(() => {
	if (!isCustom.value) return null;

	const nameFromEmoji = emoji.substr(1, emoji.length - 2);
	return customEmoji.value?.name || hostmatch.value?.[1] || nameFromEmoji || null;
});

const emojiHost = computed(() => {
	const host = customEmoji.value?.host || hostmatch.value?.[2] || props.noteHost || null;
	return host !== config.host && host !== "." ? host : null;
});

const emojiFullName = computed(() => {
	if (!customEmojiName.value) return char.value;

	const hostSuffix = emojiHost.value ? `@${emojiHost.value}` : "";
	return `${customEmojiName.value}${hostSuffix}`;
});

const urlRaw = computed(() => {
	const urlArr = [];
	if(customEmoji.value?.url && !defaultStore.state.enableDataSaverMode) urlArr.push(customEmoji.value.url);
	if(customEmojiName.value && (emojiHost || !props.nofallback)) {
		urlArr.push(`/emoji/${emojiFullName.value}.webp`);
	}
	if(customEmoji.value?.url && defaultStore.state.enableDataSaverMode) urlArr.push(customEmoji.value.url);
	return urlArr;
});

const url = computed(() => {
	if (char.value) {
		return char2filePath(char.value);
	} else if (urlRaw.value.length > errorCnt.value) {
		return defaultStore.state.disableShowingAnimatedImages || props.static
					? getStaticImageUrl(urlRaw.value[errorCnt.value])
					: urlRaw.value[errorCnt.value];
	} else {
		return "";
	}
});

const altimgUrl = computed(() => {
	if (!emojiHost.value) return "";

	const imgUrl = `https://${emojiHost.value}/emoji/${customEmojiName.value}.webp`;
	return defaultStore.state.disableShowingAnimatedImages || props.static
				? getStaticImageUrl(imgUrl)
				: imgUrl;
});

const alt = computed(() => {
	return isCustom.value ? `:${emojiFullName.value}:` : emoji;
});


let singleTapTime = undefined;

const handleImgClick = (event) => {
	if (props.note && defaultStore.state.noteReactionMenu && urlRaw.value.length >= errorCnt.value) {
		event.stopPropagation();
		// TODO: 押せるか押せないかの判定を行えるように
		const el =
			event &&
			((event.currentTarget ?? event.target) as HTMLElement | null | undefined);
		openReactionMenu_(isCustom.value ? `:${emojiFullName.value}:` : emoji, props.note, true, true, el);
	} else if (props.note && defaultStore.state.noteQuickReaction && urlRaw.value.length >= errorCnt.value) {
		event.stopPropagation();
		const el =
			ev &&
			((ev.currentTarget ?? ev.target) as HTMLElement | null | undefined);
		if (el) {
			//誤爆防止ダブルタップリアクション機能
			if (defaultStore.state.doubleTapReaction){
				if (!singleTapTime || singleTapEmoji !== emoji || (Date.now() - singleTapTime) > 2 * 1000){
					singleTapTime = Date.now();

					//アニメーション
					el.style.transition = '';
					el.style.backgroundColor = 'var(--accent)';
					setTimeout(() => {
						el.style.transition = 'background-color 1s';
						el.style.backgroundColor = 'transparent';
					}, 1500);

					return
				}
			}
			if (defaultStore.state.doubleTapReaction){
				singleTapEl.style.transition = '';
				singleTapEl.style.backgroundColor = 'transparent';
			}
			const rect = el.getBoundingClientRect();
			const x = rect.left + el.offsetWidth / 2;
			const y = rect.top + el.offsetHeight / 2;
			os.popup(Ripple, { x, y }, {}, "end");
		}

		os.api("notes/reactions/create", {
			noteId: props.note.id,
			reaction: emoji,
		});
	}
};

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
		opacity: 0.5;
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
		max-height: 100%;
	}
}
</style>
