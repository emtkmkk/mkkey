<template>
	<div
		ref="rootEl"
		class="swhvrteh _popup _shadow"
		:style="{ zIndex }"
		@contextmenu.prevent="() => {}"
	>
		<ol v-if="type === 'user'" ref="suggests" class="users">
			<li
				v-for="user in users"
				tabindex="-1"
				class="user"
				@click="complete(type, user)"
				@keydown="onKeydown"
			>
				<img class="avatar" :src="user.avatarUrl" />
				<span class="name">
					<MkUserName :key="user.id" :user="user" />
				</span>
				<span class="username">@{{ acct(user) }}</span>
			</li>
			<li
				tabindex="-1"
				class="choose"
				@click="chooseUser()"
				@keydown="onKeydown"
			>
				{{ i18n.ts.selectUser }}
			</li>
		</ol>
		<ol v-else-if="hashtags.length > 0" ref="suggests" class="hashtags">
			<li
				v-for="hashtag in hashtags"
				tabindex="-1"
				@click="complete(type, hashtag)"
				@keydown="onKeydown"
			>
				<span class="name">{{ hashtag }}</span>
			</li>
		</ol>
		<ol v-else-if="emojis.length > 0" ref="suggests" class="emojis">
			<li
				v-for="emoji in emojis"
				tabindex="-1"
				@click="complete(type, emoji.emoji)"
				@keydown="onKeydown"
			>
				<span v-if="emoji.isCustomEmoji" class="emoji"
					><MkEmoji
						class="emoji"
						:key="emoji.emoji"
						:emoji="emoji.emoji"
						:normal="true"
						:isPicker="true"
				/></span>
				<span
					v-else-if="!defaultStore.state.useOsNativeEmojis"
					class="emoji"
					><img :src="emoji.url" :alt="emoji.emoji"
				/></span>
				<span v-else class="emoji">{{ emoji.emoji }}</span>
				<span
					class="name"
					v-html="
						/[ぁ-んァ-ンー]+/.test(q) &&
						(!emoji.aliasOf || !emoji.isCustomEmoji)
							? roomajiToJa(emoji.name).replace(q, `<b>${q}</b>`)
							: emoji.name.replace(q, `<b>${q}</b>`)
					"
				></span>
				<span
					v-if="emoji.aliasOf || /[ぁ-んァ-ンー]+/.test(q)"
					class="alias"
					>({{
						/[ぁ-んァ-ンー]+/.test(q) &&
						(!emoji.aliasOf || !emoji.isCustomEmoji)
							? emoji.name
							: emoji.aliasOf
					}})</span
				>
			</li>
		</ol>
		<ol v-else-if="mfmTags.length > 0" ref="suggests" class="mfmTags">
			<li
				v-for="tag in mfmTags"
				tabindex="-1"
				@click="complete(type, tag)"
				@keydown="onKeydown"
			>
				<span class="tag">{{ `${tag.name} ${tag.ja}` }}</span>
			</li>
		</ol>
	</div>
</template>

<script lang="ts">
import {
	markRaw,
	ref,
	onUpdated,
	onMounted,
	onBeforeUnmount,
	nextTick,
	watch,
} from "vue";
import contains from "@/scripts/contains";
import { char2filePath } from "@/scripts/twemoji-base";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import { acct } from "@/filters/user";
import * as os from "@/os";
import { MFM_TAGS, MFM_TAGS_JP } from "@/scripts/mfm-tags";
import {
	formatRoomaji,
	kanaToHira,
	jaToRoomaji,
	roomajiToJa,
} from "@/scripts/convert-jp";
import { defaultStore } from "@/store";
import { emojilist } from "@/scripts/emojilist";
import { instance } from "@/instance";
import { i18n } from "@/i18n";

type EmojiDef = {
	emoji: string;
	name: string;
	aliasOf?: string;
	url?: string;
	isCustomEmoji?: boolean;
};

const lib = emojilist.filter((x) => x.category !== "flags");

const emjdb: EmojiDef[] = lib.map((x) => ({
	emoji: x.char,
	name: x.name,
	url: char2filePath(x.char),
}));

for (const x of lib) {
	if (x.keywords) {
		for (const k of x.keywords) {
			emjdb.push({
				emoji: x.char,
				name: k,
				aliasOf: x.name,
				url: char2filePath(x.char),
			});
		}
	}
}

//#region Construct Emoji DB
const customEmojis = instance.emojis;
const emojiDefinitions: EmojiDef[] = [];

for (const x of customEmojis) {
	emojiDefinitions.push({
		name: x.name.toLowerCase(),
		emoji: `:${x.name}:`,
		url: x.url,
		isCustomEmoji: true,
	});

	if (x.aliases) {
		for (const alias of x.aliases) {
			emojiDefinitions.push({
				name: alias.toLowerCase(),
				aliasOf: x.name.toLowerCase(),
				emoji: `:${x.name}:`,
				url: x.url,
				isCustomEmoji: true,
			});
		}
	}
}

const emojiDb = markRaw(emojiDefinitions.concat(emjdb));
//#endregion

export default {
	emojiDb,
	emojiDefinitions,
	emojilist,
	customEmojis,
};
</script>

<script lang="ts" setup>
const props = defineProps<{
	type: string;
	q: string | null;
	textarea: HTMLTextAreaElement;
	close: () => void;
	x: number;
	y: number;
}>();

const emit = defineEmits<{
	(event: "done", value: { type: string; value: any }): void;
	(event: "closed"): void;
}>();

const suggests = ref<Element>();
const rootEl = ref<HTMLDivElement>();

const fetching = ref(true);
const users = ref<any[]>([]);
const hashtags = ref<any[]>([]);
const emojis = ref<EmojiDef[]>([]);
const items = ref<Element[] | HTMLCollection>([]);
const mfmTags = ref<any[]>([]);
const select = ref(-1);
const zIndex = os.claimZIndex("high");

function complete(type: string, value: any) {
	emit("done", { type, value });
	emit("closed");
	if (type === "emoji") {
		let recents = defaultStore.state.recentlyUsedEmojis;
		recents = recents.filter((emoji: any) => emoji !== value);
		recents.unshift(value);
		defaultStore.set("recentlyUsedEmojis", recents.splice(0, 32));
	}
}

function setPosition() {
	if (!rootEl.value) return;
	if (props.x + rootEl.value.offsetWidth > window.innerWidth) {
		rootEl.value.style.left = `${
			window.innerWidth - rootEl.value.offsetWidth
		}px`;
	} else {
		rootEl.value.style.left = `${props.x}px`;
	}
	if (props.y + rootEl.value.offsetHeight > window.innerHeight) {
		rootEl.value.style.top = `${props.y - rootEl.value.offsetHeight}px`;
		rootEl.value.style.marginTop = "0";
	} else {
		rootEl.value.style.top = `${props.y}px`;
		rootEl.value.style.marginTop = "calc(1em + 0.5rem)";
	}
}

function exec() {
	select.value = -1;
	if (suggests.value) {
		for (const el of Array.from(items.value)) {
			el.removeAttribute("data-selected");
		}
	}
	if (props.type === "user") {
		if (!props.q) {
			users.value = [];
			fetching.value = false;
			return;
		}

		const cacheKey = `autocomplete:user:${props.q}`;
		const cache = sessionStorage.getItem(cacheKey);

		if (cache) {
			users.value = JSON.parse(cache);
			fetching.value = false;
		} else {
			os.api("users/search-by-username-and-host", {
				username: props.q,
				limit: 10,
				detail: false,
			}).then((searchedUsers) => {
				users.value = searchedUsers as any[];
				fetching.value = false;
				// キャッシュ
				sessionStorage.setItem(cacheKey, JSON.stringify(searchedUsers));
			});
		}
	} else if (props.type === "hashtag") {
		if (!props.q || props.q === "") {
			hashtags.value = JSON.parse(
				localStorage.getItem("hashtags") || "[]"
			);
			fetching.value = false;
		} else {
			const cacheKey = `autocomplete:hashtag:${props.q}`;
			const cache = sessionStorage.getItem(cacheKey);
			if (cache) {
				const hashtags = JSON.parse(cache);
				hashtags.value = hashtags;
				fetching.value = false;
			} else {
				os.api("hashtags/search", {
					query: props.q,
					limit: 30,
				}).then((searchedHashtags) => {
					hashtags.value = searchedHashtags as any[];
					fetching.value = false;
					// キャッシュ
					sessionStorage.setItem(
						cacheKey,
						JSON.stringify(searchedHashtags)
					);
				});
			}
		}
	} else if (props.type === "emoji") {
		if (!props.q || props.q === "") {
			// 最近使った絵文字をサジェスト
			emojis.value = defaultStore.state.recentlyUsedEmojis
				.map((emoji) =>
					emojiDb.find((dbEmoji) => dbEmoji.emoji === emoji)
				)
				.filter((x) => x) as EmojiDef[];
			return;
		}

		const searchQ = kanaToHira(formatRoomaji(props.q));
		const roomajiQ = formatRoomaji(jaToRoomaji(props.q));

		const matched: EmojiDef[] = [];
		const max = 30;

		emojiDb.some((x) => {
			if (
				formatRoomaji(x.name).startsWith(roomajiQ ?? "") &&
				!x.aliasOf &&
				!matched.some((y) => y.emoji === x.emoji)
			)
				matched.push(x);
			return matched.length === max;
		});

		if (matched.length < max) {
			emojiDb.some((x) => {
				if (
					formatRoomaji(x.name).startsWith(searchQ ?? "") &&
					!matched.some((y) => y.emoji === x.emoji)
				)
					matched.push(x);
				return matched.length === max;
			});
		}

		if (matched.length < max && roomajiQ !== searchQ) {
			emojiDb.some((x) => {
				if (
					formatRoomaji(x.name).includes(roomajiQ ?? "") &&
					!matched.some((y) => y.emoji === x.emoji)
				)
					matched.push(x);
				return matched.length === max;
			});
		}

		if (matched.length < max) {
			emojiDb.some((x) => {
				if (
					formatRoomaji(x.name).includes(searchQ ?? "") &&
					!matched.some((y) => y.emoji === x.emoji)
				)
					matched.push(x);
				return matched.length === max;
			});
		}

		emojis.value = matched.sort((a, b) => a.name.length - b.name.length);
	} else if (props.type === "mfmTag") {
		if (!props.q || props.q === "") {
			mfmTags.value = MFM_TAGS_JP;
			return;
		}

		mfmTags.value = MFM_TAGS_JP.filter(
			(tag) =>
				tag.name.includes(props.q ?? "") ||
				tag.ja.includes(props.q ?? "")
		);

		if (mfmTags.value.length === 0) {
			mfmTags.value = MFM_TAGS_JP;
			return;
		}
	}
}

function onMousedown(event: Event) {
	if (!contains(rootEl.value, event.target) && rootEl.value !== event.target)
		props.close();
}

function onKeydown(event: KeyboardEvent) {
	const cancel = () => {
		event.preventDefault();
		event.stopPropagation();
	};

	switch (event.key) {
		case "Enter":
			if (select.value !== -1) {
				cancel();
				(items.value[select.value] as any).click();
			} else {
				props.close();
			}
			break;

		case "Escape":
			cancel();
			props.close();
			break;

		case "ArrowUp":
			if (select.value !== -1) {
				cancel();
				selectPrev();
			} else {
				props.close();
			}
			break;

		case "ArrowDown":
			cancel();
			selectNext();
			break;

		case "Tab":
			if (event.shiftKey) {
				if (select.value !== -1) {
					cancel();
					selectPrev();
				} else {
					props.close();
				}
			} else {
				cancel();
				selectNext();
			}
			break;

		default:
			event.stopPropagation();
			props.textarea.focus();
	}
}

function selectNext() {
	if (++select.value >= items.value.length) select.value = 0;
	if (items.value.length === 0) select.value = -1;
	applySelect();
}

function selectPrev() {
	if (--select.value < 0) select.value = items.value.length - 1;
	applySelect();
}

function applySelect() {
	for (const el of Array.from(items.value)) {
		el.removeAttribute("data-selected");
	}

	if (select.value !== -1) {
		items.value[select.value].setAttribute("data-selected", "true");
		(items.value[select.value] as any).focus();
	}
}

function chooseUser() {
	props.close();
	os.selectUser().then((user) => {
		props.textarea.focus();
		complete("user", user);
	});
}

onUpdated(() => {
	setPosition();
	items.value = suggests.value?.children ?? [];
});

onMounted(() => {
	setPosition();

	props.textarea.addEventListener("keydown", onKeydown);

	for (const el of Array.from(document.querySelectorAll("body *"))) {
		el.addEventListener("mousedown", onMousedown);
	}

	nextTick(() => {
		exec();

		watch(
			() => props.q,
			() => {
				nextTick(() => {
					exec();
				});
			}
		);
	});
});

onBeforeUnmount(() => {
	props.textarea.removeEventListener("keydown", onKeydown);

	for (const el of Array.from(document.querySelectorAll("body *"))) {
		el.removeEventListener("mousedown", onMousedown);
	}
});
</script>

<style lang="scss" scoped>
.swhvrteh {
	position: fixed;
	max-width: 100%;
	margin-top: calc(1em + 0.5rem);
	overflow: hidden;
	transition: top 0.1s ease, left 0.1s ease;

	> ol {
		display: block;
		margin: 0;
		padding: 0.25rem 0;
		max-height: 11.875rem;
		max-width: 31.25rem;
		overflow: auto;
		list-style: none;

		> li {
			display: flex;
			align-items: center;
			padding: 0.25rem 0.75rem;
			white-space: nowrap;
			overflow: hidden;
			font-size: 0.9em;
			cursor: default;

			&,
			* {
				user-select: none;
			}

			* {
				overflow: hidden;
				text-overflow: ellipsis;
			}

			&:hover {
				background: var(--X3);
			}

			&[data-selected="true"] {
				background: var(--accent);

				&,
				* {
					color: #fff !important;
				}
			}

			&:active {
				background: var(--accentDarken);

				&,
				* {
					color: #fff !important;
				}
			}
		}
	}

	> .users > li {
		.avatar {
			min-width: 1.75rem;
			min-height: 1.75rem;
			max-width: 1.75rem;
			max-height: 1.75rem;
			margin: 0 0.5rem 0 0;
			border-radius: 100%;
		}

		.name {
			margin: 0 0.5rem 0 0;
		}
	}

	> .emojis > li {
		.emoji {
			display: inline-block;
			margin: 0 0.25rem 0 0;
			min-width: 1.25rem;

			> img {
				height: 1.25rem;
				vertical-align: bottom;
			}
		}

		.alias {
			margin: 0 0 0 0.5rem;
		}
	}

	> .mfmTags > li {
		.name {
		}
	}
}
</style>
