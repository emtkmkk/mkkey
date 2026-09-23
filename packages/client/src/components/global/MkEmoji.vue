<template>
	<img
		v-if="isCustom && !hideEmojiImage && urlRaw.length > errorCnt"
		class="mk-emoji"
		:class="{
			normal,
			noStyle,
			bigCustom,
			custom: !bigCustom,
			['mfm-x' + (size || 2)]: mfmx,
		}"
		v-emoji-src="url"
		:title="title"
		:alt="alt"
		decoding="async"
		@click="handleImgClick"
		@load="onCustomLoad"
		@error="onCustomError"
	/>
	<img
		v-else-if="char && !useOsNativeEmojis && !errorAlt"
		class="mk-emoji"
		:class="{ ['mfm-x' + (size || 2)]: mfmx }"
		v-emoji-src="url"
		:title="title"
		:alt="alt"
		decoding="async"
		@click="handleImgClick"
		@error="
			() => {
				errorAlt = true;
				if (!instance.errorEmojiAlt) {
					instance.errorEmojiAlt = {};
				}
				instance.errorEmojiAlt[
					emoji
				] = true;
			}
		"
	/>
	<span
		v-else-if="char && (useOsNativeEmojis || errorAlt)"
		@click="handleImgClick"
		:class="{ ['mfm-x' + (size || 2)]: mfmx }"
		>{{ char }}</span
	>
	<img
		v-else-if="
			isCustom &&
			!hideEmojiImage &&
			urlRaw.length <= errorCnt &&
			!isPicker &&
			emojiHost &&
			!errorAlt
		"
		class="mk-emoji emoji-ghost"
		:class="{
			normal,
			noStyle,
			bigCustom,
			custom: !bigCustom,
			['mfm-x' + (size || 2)]: mfmx,
		}"
		v-emoji-src="altimgUrl"
		:title="title + ' [localOnly]'"
		:alt="alt"
		v-tooltip="emojiHost + ' localOnly'"
		decoding="async"
		@error="
			() => {
				errorAlt = true;
				if (!instance.errorEmojiAlt) {
					instance.errorEmojiAlt = {};
				}
				instance.errorEmojiAlt[
					emoji + (noteHost ? '@' + noteHost : '')
				] = true;
			}
		"
	/>
	<img
		v-else-if="isCustom && customEmojiName && isReaction"
		class="mk-emoji"
		:class="{
			normal,
			noStyle,
		}"
		src="/static-assets/user-unknown.png"
		:alt="alt"
		decoding="async"
	/>
	<span v-else>{{
		isCustom && customEmojiName && !isReaction
			? `:${customEmojiName}:`
			: emoji
	}}</span>
</template>
<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * カスタム絵文字表示コンポーネント。isMuted 時は画像にせず :name: のまま表示。
 *
 * @remarks
 * note の emojis / reactionEmojis に hiddenForViewer が true のときは画像にせず :name: のまま表示（isMuted と同様）。
 *
 * カスタム絵文字は候補 URL（{@link urlRaw}）を先頭から順に試す。
 * `/emoji/` 経由の外部プロキシが失敗したとき（HTTP エラー、またはエラー画像）は、
 * 別のプロキシ → このサーバの `/proxy` の候補へ進む（{@link getEmojiFallbackUrls}）。
 */
import { computed, ref, watch } from "vue";
import { CustomEmoji } from "calckey-js/built/entities";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import {
	getEmojiFallbackUrls,
	isProxyErrorImage,
} from "@/scripts/media-proxy-fallback";
import { char2filePath } from "@/scripts/twemoji-base";
import { defaultStore } from "@/store";
import { instance, emojiMap } from "@/instance";
import { openReactionMenu_ } from "@/scripts/reaction-menu";
import * as os from "@/os";
import * as config from "@/config";
import seedrandom from "seedrandom";
import * as sound from "@/scripts/sound.js";

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
	size?: number;
}>();

const emit = defineEmits(["loaderror"]);
const replace =
	!props.noreplace &&
	!props.isPicker &&
	defaultStore.state.enableEmojiReplace &&
	defaultStore.state.allEmojiReplace.length &&
	!defaultStore.state.allEmojiReplace.includes(
		props.emoji.replace("@.", "").replace("@" + config.host, "")
	);
const emoji = replace
	? defaultStore.state.allEmojiReplace[
			Math.floor(
				seedrandom(
					props.emoji?.replaceAll(":", "")?.split("@")?.[0] ||
						props.emoji
				)() * defaultStore.state.allEmojiReplace.length
			)
	  ]
	: defaultStore.state.replaceMakudo === "makku" ? props.emoji?.replace(":makudo:",":makku:")
	: defaultStore.state.replaceMakudo === "makudo" ? props.emoji?.replace(":makku:",":makudo:")
	: props.emoji;
const isCustom = computed(() => emoji.startsWith(":"));
const bigCustom = computed(() => defaultStore.state.useBigCustom);
const char = computed(() => (isCustom.value ? null : emoji));
const hostmatch = computed(() =>
	emoji ? emoji.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/) : undefined
);
const useOsNativeEmojis = computed(
	() => defaultStore.state.useOsNativeEmojis && !props.isReaction
);
const errorCnt = ref(instance.errorEmoji?.[emoji] ?? 0);
const errorAlt = ref(instance.errorEmojiAlt?.[emoji] ?? false);
const mfmx = props.size && props.size >= 2 && props.size <= 4;
const isMuted = computed(() => {
	if (!emoji) return false;
	const reactionMuted = defaultStore.state.reactionMutedWords.map((x) => {
		return {
			name: x.replaceAll(":", "").replace("@", ""),
			exact: /^:@?\w+:$/.test(x),
			hostmute: /^:?@[\w.-]/.test(x),
		};
	});
	return reactionMuted.some((x) => {
		const emojiName = emoji.replace(":", "").replace(/@[\w:\.\-]+:$/, "");
		const emojiHost = emoji.replace(/^:[\w:\.\-]+@/, "").replace(":", "");
		if (x.exact) {
			if (x.hostmute) {
				if (x.name === emojiHost) {
					emit("loaderror", "");
					return true;
				}
			} else {
				if (x.name === emojiName) {
					emit("loaderror", "");
					return true;
				}
			}
		} else {
			if (x.hostmute) {
				if (emojiHost.includes(x.name)) {
					emit("loaderror", "");
					return true;
				}
			} else {
				if (emojiName.includes(x.name)) {
					emit("loaderror", "");
					return true;
				}
			}
		}
		return false;
	});
});

const ce = computed(() => instance.emojis ?? []);
const customEmoji = computed(() => {
	if (!isCustom.value) return null;

	const name = hostmatch.value?.[1];
	const host =
		hostmatch.value?.[2] || (!replace ? props.noteHost : undefined);

	const matchprops = props.customEmojis?.find(
		(x) => x.url && x.name === emoji.toLowerCase().substr(1, emoji.length - 2)
	);

	if (matchprops) {
		return { ...matchprops, name, host };
	} else if (host && host !== "." && host !== config.host) {
		return { name, host };
	} else {
		const cefind = emojiMap.value.get(name?.toLowerCase());
		if (cefind || props.nofallback) {
			return cefind;
		} else {
			emit("loaderror", "");
			// ローカル絵文字が見つからない場合、aliasesを検索
			return ce.value.find((x) =>
				x.aliases?.some((y) => /^\w+$/.test(y) && y === name?.toLowerCase())
			);
		}
	}
});

const customEmojiName = computed(() => {
	if (!isCustom.value) return null;

	const nameFromEmoji = emoji.substr(1, emoji.length - 2);
	return (
		customEmoji.value?.name || hostmatch.value?.[1] || nameFromEmoji || null
	);
});

const emojiHost = computed(() => {
	const host =
		customEmoji.value?.host ||
		hostmatch.value?.[2] ||
		props.noteHost ||
		null;
	return host !== config.host && host !== "." ? host : null;
});

const emojiFullName = computed(() => {
	if (!customEmojiName.value) return char.value;

	const hostSuffix = emojiHost.value ? `@${emojiHost.value}` : "";
	return `${customEmojiName.value}${hostSuffix}`;
});

/** ノートの emojis / reactionEmojis で hiddenForViewer が true の絵文字は画像にせず :name: のまま表示（ブロック関係等） */
const isHiddenForViewer = computed(() => {
	if (!props.note?.emojis?.length && !props.note?.reactionEmojis?.length) return false;
	const name = customEmojiName.value;
	if (!name) return false;
	const list = [...(props.note.emojis ?? []), ...(props.note.reactionEmojis ?? [])];
	const entry = list.find((e: { name: string; hiddenForViewer?: boolean }) => {
		const en = e.name.replace(/@.*$/, "");
		return en === name || e.name === name || e.name === `${name}@.`;
	});
	return entry?.hiddenForViewer === true;
});
const hideEmojiImage = computed(() => isMuted.value || isHiddenForViewer.value);

const originalEmojiFullName = $computed(() => {
	if (!props.emoji.startsWith(":")) return props.emoji;

	const hostmatch = computed(() =>
		props.emoji?.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/)
	);

	const name = hostmatch.value?.[1];
	let host = hostmatch.value?.[2] || props.noteHost;

	if (host && (host === "." || host === config.host)) {
		host = undefined;
	}

	const hostSuffix = host ? `@${host}` : "";
	return `:${name}${hostSuffix}:`;
});

const urlRaw = computed(() => {
	const urlArr = [];
	if (customEmoji.value?.url && !defaultStore.state.enableDataSaverMode)
		urlArr.push(customEmoji.value.url);
	if (customEmojiName.value && (emojiHost || !props.nofallback)) {
		const emojiUrl = `/emoji/${emojiFullName.value}.webp`;
		// 外部プロキシが失敗したときに、別のプロキシ → このサーバの /proxy の順に読み直す
		urlArr.push(emojiUrl, ...getEmojiFallbackUrls(emojiUrl));
	}
	if (customEmoji.value?.url && defaultStore.state.enableDataSaverMode)
		urlArr.push(customEmoji.value.url);
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

/**
 * カスタム絵文字の画像が読めなかったとき、次の候補 URL へ進める
 *
 * @remarks
 * 失敗回数は `instance.errorEmoji` にも残し、同じ絵文字の別の表示箇所で失敗済みの URL を飛ばす。
 *
 * @internal
 */
function onCustomError() {
	errorCnt.value = errorCnt.value + 1;
	if (props.isPicker && urlRaw.value.length <= errorCnt.value) {
		emit("loaderror", "");
	}
	if (!instance.errorEmoji) {
		instance.errorEmoji = {};
	}
	instance.errorEmoji[emoji + (props.noteHost ? "@" + props.noteHost : "")] =
		errorCnt.value;
}

/**
 * カスタム絵文字の画像が読み込めたとき
 *
 * @remarks
 * 外部プロキシはエラー時にもエラー画像を「成功」として返すことがある。
 * その場合は読み込み失敗と同じ扱いにして、次の候補 URL へ進める。
 *
 * @param ev - load イベント
 * @internal
 */
async function onCustomLoad(ev: Event) {
	const img = ev.target as HTMLImageElement;
	const src = url.value;
	if (!(await isProxyErrorImage(img))) return;
	// 判定の間に別の URL へ変わっていたら何もしない
	if (src !== url.value) return;
	onCustomError();
}

const altimgUrl = computed(() => {
	if (!emojiHost.value) return "";

	const imgUrl = `https://${emojiHost.value}/emoji/${customEmojiName.value}.webp`;
	return defaultStore.state.disableShowingAnimatedImages || props.static
		? getStaticImageUrl(imgUrl)
		: imgUrl;
});

const title = computed(() => {
	const alt = isCustom.value ? `:${emojiFullName.value}:` : emoji;
	return (
		alt +
		(alt !== originalEmojiFullName
			? " (" + originalEmojiFullName + ")"
			: "")
	);
});

const alt = computed(() => {
	return isCustom.value ? `:${emojiFullName.value}:` : emoji;
});

let singleTapTime = undefined;

const handleImgClick = async (event) => {
	if (
		(props.note || props.reactionMenuEnabled) &&
		defaultStore.state.noteReactionMenu &&
		urlRaw.value.length >= errorCnt.value
	) {
		event.stopPropagation();
		// TODO: 押せるか押せないかの判定を行えるように
		const el =
			event &&
			((event.currentTarget ?? event.target) as
				| HTMLElement
				| null
				| undefined);
		await openReactionMenu_(
			replace
				? originalEmojiFullName
				: isCustom.value
				? `:${emojiFullName.value}:`
				: emoji,
			props.note,
			true,
			true,
			el
		);
	} else if (
		props.note &&
		defaultStore.state.noteQuickReaction &&
		urlRaw.value.length >= errorCnt.value
	) {
		event.stopPropagation();
		const el =
			ev &&
			((ev.currentTarget ?? ev.target) as HTMLElement | null | undefined);
		if (el) {
			//誤爆防止ダブルタップリアクション機能
			if (defaultStore.state.doubleTapReaction) {
				if (
					!singleTapTime ||
					singleTapEmoji !== emoji ||
					Date.now() - singleTapTime > 2 * 1000
				) {
					singleTapTime = Date.now();

					//アニメーション
					el.style.transition = "";
					el.style.backgroundColor = "var(--accent)";
					setTimeout(() => {
						el.style.transition = "background-color 1s";
						el.style.backgroundColor = "transparent";
					}, 1500);

					return;
				}
			}
			if (defaultStore.state.doubleTapReaction) {
				singleTapEl.style.transition = "";
				singleTapEl.style.backgroundColor = "transparent";
			}
			const rect = el.getBoundingClientRect();
			const x = rect.left + el.offsetWidth / 2;
			const y = rect.top + el.offsetHeight / 2;
			os.popup(Ripple, { x, y }, {}, "end");
		}

		os.api("notes/reactions/create", {
			noteId: props.note.id,
			reaction: emoji,
		}).then(() => {
			sound.play("reaction");
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
