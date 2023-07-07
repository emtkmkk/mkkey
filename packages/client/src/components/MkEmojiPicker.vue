<template>
	<FocusTrap v-bind:active="isActive">
		<div
			class="omfetrab"
			:class="['s' + size, 'w' + width, 'h' + height, { asDrawer }]"
			:style="{ maxHeight: maxHeight ? maxHeight + 'px' : undefined }"
			tabindex="-1"
		>
			<input
				ref="search"
				v-model.trim="q"
				class="search filled"
				data-prevent-emoji-insert
				:placeholder="i18n.ts.search"
				type="search"
				@paste.stop="paste"
				@keyup.enter="done()"
			/>
			<div ref="emojis" class="emojis">
				<section class="result">
					<div v-if="!props.asReactionPicker && q && q.endsWith('@')">
						<header class="_acrylic">{{ "@（他鯖絵文字検索）はリアクション時のみ使用可能です。" }}</header>
					</div>
					<div v-else>
						<header class="_acrylic" v-if="!(q == null || q === '')">
							{{ `${q.endsWith('@') ? "他サーバー絵文字検索 " : "検索結果 "}
							${(searchResultCustomStart.length + searchResultUnicodeStart.length + searchResultCustom.length + searchResultUnicode.length) !== 0 
								? `${(searchResultCustomStart.length + searchResultUnicodeStart.length) + " / " + (searchResultCustom.length + searchResultUnicode.length)} 件` 
								: "0 件"}${props.asReactionPicker && !q.endsWith('@') ? " (@で他サーバー絵文字検索)" + ""}
							` }}
						</header>
					</div>
					<div v-if="searchResultCustomStart.length > 0" class="body">
						<button
							v-for="emoji in searchResultCustomStart"
							:key="emoji.id"
							class="_button item"
							:title="emoji.name + (emoji.host ? '@' + emoji.host : '')"
							tabindex="0"
							@click="chosen(emoji, $event)"
						>
							<!--<MkEmoji v-if="emoji.char != null" :emoji="emoji.char"/>-->
							<img
								class="emoji"
								:src="
									disableShowingAnimatedImages
										? getStaticImageUrl(emoji.url)
										: emoji.url
								"
							/>
						</button>
					</div>
					<div v-if="searchResultUnicodeStart.length > 0" class="body">
						<button
							v-for="emoji in searchResultUnicodeStart"
							:key="emoji.name"
							class="_button item"
							:title="emoji.name"
							tabindex="0"
							@click="chosen(emoji, $event)"
						>
							<MkEmoji class="emoji" :emoji="emoji.char" />
						</button>
					</div>
					<div v-if="searchResultCustom.length > 0" class="body">
						<button
							v-for="emoji in searchResultCustom"
							:key="emoji.id"
							class="_button item"
							:title="emoji.name + (emoji.host ? '@' + emoji.host : '')"
							tabindex="0"
							@click="chosen(emoji, $event)"
						>
							<!--<MkEmoji v-if="emoji.char != null" :emoji="emoji.char"/>-->
							<img
								class="emoji"
								:src="
									disableShowingAnimatedImages
										? getStaticImageUrl(emoji.url)
										: emoji.url
								"
							/>
						</button>
					</div>
					<div v-if="searchResultUnicode.length > 0" class="body">
						<button
							v-for="emoji in searchResultUnicode"
							:key="emoji.name"
							class="_button item"
							:title="emoji.name"
							tabindex="0"
							@click="chosen(emoji, $event)"
						>
							<MkEmoji class="emoji" :emoji="emoji.char" />
						</button>
					</div>
				</section>

				<div v-if="!$store.state.hiddenReactionDeckAndRecent && tab === 'index' && searchResultCustom.length <= 0 && (q == null || q === '')" class="group index">
					<section v-if="showPinned">
						<div class="body">
							<button
								v-for="emoji in pinned.filter((x) => props.asReactionPicker || !x.includes('@'))"
								:key="emoji"
								class="_button item"
								tabindex="0"
								@click="chosen(emoji, $event)"
							>
								<MkEmoji
									class="emoji"
									:emoji="emoji"
									:normal="true"
								/>
							</button>
						</div>
					</section>

					<section>
						<header class="_acrylic">
							<i class="ph-alarm ph-bold ph-fw ph-lg"></i>
							{{ i18n.ts.recentUsed }}
						</header>
						<div class="body">
							<button
								v-for="emoji in recentlyUsedEmojis.filter((x) => props.asReactionPicker || !x.includes('@'))"
								:key="emoji"
								class="_button item"
								@click="chosen(emoji, $event)"
							>
								<MkEmoji
									class="emoji"
									:emoji="emoji"
									:normal="true"
								/>
							</button>
						</div>
					</section>
				</div>
				<div v-once v-if="searchResultCustom.length <= 0 && (q == null || q === '')" class="group">
					<header>{{ i18n.ts.customEmojis }}</header>
					<XSection
						key="custom:recentlyAddEmojis"
						:initial-shown="false"
						:emojis="
							customEmojis
								.filter((e) => e.updatedAt ? new Date().valueOf() - new Date(e.updatedAt).valueOf() < 7 * 24 * 60 * 60 * 1000 : false)
								.sort((a,b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf())
								.slice(0,255)
								.map((e) => ':' + e.name + ':')
						"
						@chosen="chosen"
						>{{ i18n.ts.recentlyAddEmojis }}</XSection
					>
					<XSection
						v-for="category in customEmojiCategories"
						:key="'custom:' + category"
						:initial-shown="false"
						:emojis="
							customEmojis
								.filter((e) => e.category === category)
								.map((e) => ':' + e.name + ':')
						"
						@chosen="chosen"
						>{{ category || i18n.ts.other }}</XSection
					>
					<template v-if="$store.state.japanCategory">
						<XSection
							key="custom:null/A"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[aiueo]/i.test(format_roomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.silce(0,1)) - sortWord.indexOf(b.silce(0,1)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / あ行" }}</XSection
						>
						<XSection
							key="custom:null/KG"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[kg]([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => ['k','g'].indexOf(a.silce(0,1)) - ['k','g'].indexOf(b.silce(0,1)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / か行" }}</XSection
						>
						<XSection
							key="custom:null/SZ"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[sz]([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => ['s','z'].indexOf(a.silce(0,1)) - ['s','z'].indexOf(b.silce(0,1)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / さ行" }}</XSection
						>
						<XSection
							key="custom:null/TD"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[td]([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => ['t','d'].indexOf(a.silce(0,1)) - ['t','d'].indexOf(b.silce(0,1)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / た行" }}</XSection
						>
						<XSection
							key="custom:null/N"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^n([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / な行" }}</XSection
						>
						<XSection
							key="custom:null/HBP"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[hbp]([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => ['h','b','p'].indexOf(a.silce(0,1)) - ['h','b','p'].indexOf(b.silce(0,1)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / は行" }}</XSection
						>
						<XSection
							key="custom:null/M"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^m([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / ま行" }}</XSection
						>
						<XSection
							key="custom:null/Y"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[y]([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / や行" }}</XSection
						>
						<XSection
							key="custom:null/R"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[r]([aiueo]|y[aiueo])/i.test(format_roomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / ら行" }}</XSection
						>
						<XSection
							key="custom:null/W"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^([w]([aiueo]|y[aiueo])|n([^aiueoy]))/i.test(format_roomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.silce(1,2)) - sortWord.indexOf(b.silce(1,2)))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / わ行" }}</XSection
						>
						<XSection
							key="custom:null/jpetc"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && !/^(?![aiueo]|[kgsztdnhbpmyrwaiueo][aiueoy])/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / その他" }}</XSection
						>
					</template>
					<template v-else>
						<XSection
							key="custom:null/A-D"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[a-d]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / A-D" }}</XSection
						>
						<XSection
							key="custom:null/E-G"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[e-g]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / E-G" }}</XSection
						>
						<XSection
							key="custom:null/H-K"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[h-k]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / H-K" }}</XSection
						>
						<XSection
							key="custom:null/L-N"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[l-n]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / L-N" }}</XSection
						>
						<XSection
							key="custom:null/O-Q"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[o-q]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / O-Q" }}</XSection
						>
						<XSection
							key="custom:null/R-T"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[r-t]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / R-T" }}</XSection
						>
						<XSection
							key="custom:null/U-W"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[u-w]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / U-W" }}</XSection
						>
						<XSection
							key="custom:null/X-Z"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && /^[x-z]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / X-Z" }}</XSection
						>
						<XSection
							key="custom:null/etc"
							:initial-shown="false"
							:emojis="
								customEmojis
									.filter((e) => !e.category && !/^[a-z]/i.test(e.name))
									.map((e) => ':' + e.name + ':')
							"
							@chosen="chosen"
							>{{ "未設定 / その他" }}</XSection
						>
					</template>
				</div>
				<div v-once v-if="searchResultCustom.length <= 0  && (q == null || q === '')" class="group">
					<header>{{ i18n.ts.emoji }}</header>
					<XSection
						v-for="category in categories"
						:key="category"
						:emojis="
							emojilist
								.filter((e) => e.category === category)
								.map((e) => e.char)
						"
						@chosen="chosen"
						>{{ category }}</XSection
					>
				</div>
			</div>
			<div class="tabs">
				<button
					class="_button tab"
					:class="{ active: tab === 'index' }"
					@click="tab = 'index'"
				>
					<i class="ph-asterisk ph-bold ph-lg ph-fw ph-lg"></i>
				</button>
				<button
					class="_button tab"
					:class="{ active: tab === 'custom' }"
					@click="tab = 'custom'"
				>
					<i class="ph-smiley ph-bold ph-lg ph-fw ph-lg"></i>
				</button>
				<button
					class="_button tab"
					:class="{ active: tab === 'unicode' }"
					@click="tab = 'unicode'"
				>
					<i class="ph-leaf ph-bold ph-lg ph-fw ph-lg"></i>
				</button>
				<button
					class="_button tab"
					:class="{ active: tab === 'tags' }"
					@click="tab = 'tags'"
				>
					<i class="ph-hash ph-bold ph-lg ph-fw ph-lg"></i>
				</button>
			</div>
		</div>
	</FocusTrap>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from "vue";
import * as Misskey from "calckey-js";
import XSection from "@/components/MkEmojiPicker.section.vue";
import {
	emojilist,
	UnicodeEmojiDef,
	unicodeEmojiCategories as categories,
} from "@/scripts/emojilist";
import { getStaticImageUrl } from "@/scripts/get-static-image-url";
import Ripple from "@/components/MkRipple.vue";
import * as os from "@/os";
import { isTouchUsing } from "@/scripts/touch";
import { deviceKind } from "@/scripts/device-kind";
import { emojiCategories, instance } from "@/instance";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { FocusTrap } from "focus-trap-vue";

const props = withDefaults(
	defineProps<{
		showPinned?: boolean;
		asReactionPicker?: boolean;
		maxHeight?: number;
		asDrawer?: boolean;
	}>(),
	{
		showPinned: true,
	}
);

const emit = defineEmits<{
	(ev: "chosen", v: string): void;
}>();

const search = ref<HTMLInputElement>();
const emojis = ref<HTMLDivElement>();

const {
	reactions: pinned,
	reactionPickerSize,
	reactionPickerWidth,
	reactionPickerHeight,
	disableShowingAnimatedImages,
	recentlyUsedEmojis,
} = defaultStore.reactiveState;

const size = computed(() =>
	props.asReactionPicker ? reactionPickerSize.value : 1
);
const width = computed(() =>
	props.asReactionPicker ? reactionPickerWidth.value : 3
);
const height = computed(() =>
	props.asReactionPicker ? reactionPickerHeight.value : 2
);
const customEmojiCategories = emojiCategories;
const customEmojis = instance.emojis;
const allCustomEmojis = props.asReactionPicker ? instance.allEmojis : undefined;
const q = ref<string | null>(null);
const searchResultCustom = ref<Misskey.entities.CustomEmoji[]>([]);
const searchResultCustomStart = ref<Misskey.entities.CustomEmoji[]>([]);
const searchResultUnicode = ref<UnicodeEmojiDef[]>([]);
const searchResultUnicodeStart = ref<UnicodeEmojiDef[]>([]);
const tab = ref<"index" | "custom" | "unicode" | "tags">("index");
const sortWord = ["a","i","u","e","o","y"];

watch(q, (nQ, oQ) => {
	if (q.value.endsWith("＠")) q.value = oQ + "@";
	
	if (emojis.value) emojis.value.scrollTop = 0;
	
	if (q.value == null || q.value.replace(/[:@]/g,"") === "") {
		searchResultCustom.value = [];
		searchResultCustomStart.value = [];
		searchResultUnicode.value = [];
		searchResultUnicodeStart.value = [];
		return;
	}
	
	if (nQ?.length + 1 === oQ?.length && nQ + "@" !== oQ) {
		return;
	}

	const isAllSearch = allCustomEmojis ? q.value.endsWith("@") : false;
	const newQ = kanaToHira(format_roomaji(q.value.replace(/[:@]/g, "")));
	const roomajiQ = format_roomaji(ja_to_roomaji(q.value.replace(/[:@]/g, "")));
	
	const searchCustom = () => {
		const max = 64;
		const emojis = customEmojis;
		const allEmojis = allCustomEmojis;
		const matches = new Set<Misskey.entities.CustomEmoji>();

		if (newQ.includes(" ")) {
			// AND検索
			const keywords = newQ.split(" ");
			const roomajiKeywords = roomajiQ.split(" ");

			// 名前またはエイリアスにキーワードが含まれている
			if (isAllSearch) {
				for (const emoji of allEmojis) {
					if (
						keywords.every(
							(keyword) =>
								format_roomaji(emoji.name).includes(roomajiKeywords)
						)
					) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
				if (matches.size >= max) return matches;
			} else {
				
				for (const emoji of emojis) {
					if (
						keywords.every(
							(keyword) =>
								format_roomaji(emoji.name).includes(roomajiKeywords) ||
								emoji.aliases.some((alias) =>
									format_roomaji(alias).includes(keyword)
								)
						)
					) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
				if (matches.size >= max) return matches;

				// 名前にキーワードが含まれている
				for (const emoji of emojis) {
					if (keywords.every((keyword) => format_roomaji(emoji.name).includes(roomajiKeywords))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
				
			}
		} else {
			if (isAllSearch) {
				for (const emoji of allEmojis) {
					if (!format_roomaji(emoji.name).startsWith(roomajiQ)) {
						if (format_roomaji(emoji.name).includes(roomajiQ)) {
							matches.add(emoji);
							if (matches.size >= max) break;
						}
					}
				}
				if (matches.size >= max) return matches;
			} else {
				for (const emoji of emojis) {
					if (!format_roomaji(emoji.name).startsWith(roomajiQ)) {
						if (format_roomaji(emoji.name).includes(roomajiQ)) {
							matches.add(emoji);
							if (matches.size >= max) break;
						}
					}
				}
				if (matches.size >= max) return matches;

				for (const emoji of emojis) {
					if (!emoji.aliases.some((alias) => kanaToHira(format_roomaji(alias)).startsWith(newQ))) {
						if (emoji.aliases.some((alias) => kanaToHira(format_roomaji(alias)).includes(newQ))) {
							matches.add(emoji);
							if (matches.size >= max) break;
						}
					}
				}
			}
		}

		return matches;
	};
	const searchCustomStart = () => {
		const max = 99;
		const emojis = customEmojis;
		const allEmojis = allCustomEmojis;
		const matches = new Set<Misskey.entities.CustomEmoji>();
		const beforeSort = new Set();

		if (newQ.includes(" ")) {
			// AND検索
			return matches;
		} else {
			if (isAllSearch) {
				for (const emoji of allEmojis) {
					if (format_roomaji(emoji.name).startsWith(roomajiQ)) {
						if (beforeSort.size >= max) break;
						beforeSort.add({
							emoji: emoji,
							key: format_roomaji(emoji.name),
						});
					}
				}
			} else {
				const exactMatch = emojis.find((emoji) => emoji.name === roomajiQ);
				if (exactMatch) beforeSort.add({emoji: exactMatch,key: format_roomaji(exactMatch.name),});
				for (const emoji of emojis) {
					if (format_roomaji(emoji.name).startsWith(roomajiQ)) {
						if (beforeSort.size >= max) break;
						beforeSort.add({
							emoji: emoji,
							key: format_roomaji(emoji.name),
						});
					}
				}

				emojifor : for (const emoji of emojis) {
					for (const alias of emoji.aliases) {
						if (kanaToHira(format_roomaji(alias)).startsWith(newQ)) {
							if (beforeSort.size >= max) break emojifor;
							beforeSort.add({
								emoji: emoji,
								key: format_roomaji(alias),
							});
						}
					}
				}
			}
		}

		return new Set(Array.from(beforeSort).sort((a, b) => a.key.length - b.key.length).map((x) => x.emoji));
	};
	
	const searchUnicode = () => {
		const max = 20;
		const emojis = emojilist;
		const matches = new Set<UnicodeEmojiDef>();
		
		if (isAllSearch) return matches;
		if (newQ.includes(" ")) {
			// AND検索
			const keywords = newQ.split(" ");
			const roomajiKeywords = roomajiQ.split(" ");

			// 名前にキーワードが含まれている
			for (const emoji of emojis) {
				if (keywords.every((keyword) => format_roomaji(emoji.name).includes(roomajiKeywords))) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
			if (matches.size >= max) return matches;

			// 名前またはエイリアスにキーワードが含まれている
			for (const emoji of emojis) {
				if (
					keywords.every(
						(keyword) =>
							format_roomaji(emoji.name).includes(roomajiKeywords) ||
							emoji.keywords.some((alias) =>
								format_roomaji(alias).includes(keyword)
							)
					)
				) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
		} else {
			for (const emoji of emojis) {
				if (!format_roomaji(emoji.name).startsWith(roomajiQ)) {
					if (format_roomaji(emoji.name).includes(roomajiQ)) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (
					!emoji.keywords.some((keyword) => format_roomaji(keyword).startsWith(roomajiQ))
				) {
					if (emoji.keywords.some((keyword) => format_roomaji(keyword).includes(roomajiQ))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}
		}

		return matches;
	};
	
	const searchUnicodeStart = () => {
		const max = 40;
		const emojis = emojilist;
		const matches = new Set<UnicodeEmojiDef>();
		const beforeSort = new Set();

		if (isAllSearch) return matches;
		const exactMatch = emojis.find((emoji) => format_roomaji(emoji.name) === roomajiQ);
		if (exactMatch) beforeSort.add({emoji: exactMatch,key: format_roomaji(exactMatch.name),});

		if (newQ.includes(" ")) {
			// AND検索
			return matches;
		} else {
			for (const emoji of emojis) {
				if (format_roomaji(emoji.name).startsWith(roomajiQ)) {
					if (beforeSort.size >= max) break;
					beforeSort.add({
						emoji: emoji,
						key: format_roomaji(emoji.name),
					});
				}
			}

			emojifor : for (const emoji of emojis) {
				for (const keyword of emoji.keywords) {
					if (
						format_roomaji(keyword).startsWith(roomajiQ)
					) {
						if (beforeSort.size >= max) break emojifor;
						beforeSort.add({
							emoji: emoji,
							key: format_roomaji(keyword),
						});
					}
				}
			}
		}
		
		return new Set(Array.from(beforeSort).sort((a, b) => a.key.length - b.key.length).map((x) => x.emoji));
	};

	searchResultCustom.value = Array.from(searchCustom());
	searchResultCustomStart.value = Array.from(searchCustomStart());
	searchResultUnicode.value = Array.from(searchUnicode());
	searchResultUnicodeStart.value = Array.from(searchUnicodeStart());
});

function focus() {
	// || (!["smartphone", "tablet"].includes(deviceKind) && !isTouchUsing) は一旦OFF
	if ((!props.asReactionPicker && defaultStore.state.postAutoFocusSearchBar) || (props.asReactionPicker && defaultStore.state.reactionAutoFocusSearchBar)) {
		search.value?.focus({
			preventScroll: true,
		});
	}
}

function reset() {
	if (emojis.value) emojis.value.scrollTop = 0;
	q.value = "";
}

function getKey(
	emoji: string | Misskey.entities.CustomEmoji | UnicodeEmojiDef
): string {
	return typeof emoji === "string" ? emoji : emoji.char || `:${emoji.name}${emoji.host ? "@" + emoji.host : ""}:`;
}

function chosen(emoji: any, ev?: MouseEvent) {
	const el =
		ev &&
		((ev.currentTarget ?? ev.target) as HTMLElement | null | undefined);
	if (el) {
		const rect = el.getBoundingClientRect();
		const x = rect.left + el.offsetWidth / 2;
		const y = rect.top + el.offsetHeight / 2;
		os.popup(Ripple, { x, y }, {}, "end");
	}

	const key = getKey(emoji);
	emit("chosen", key);

	// 最近使った絵文字更新
	if (!pinned.value.includes(key)) {
		let recents = defaultStore.state.recentlyUsedEmojis;
		recents = recents.filter((emoji: any) => emoji !== key);
		recents.unshift(key);
		defaultStore.set("recentlyUsedEmojis", recents.splice(0, 48));
	}
}

function paste(event: ClipboardEvent) {
	const paste = (event.clipboardData || window.clipboardData).getData("text");
	if (done(paste)) {
		event.preventDefault();
	}
}

function done(query?: any): boolean | void {
	if (query == null) query = q.value;
	if (query == null || typeof query !== "string") return;

	const q2 = query.replaceAll(":", "");
	if (q2.endsWith(' -f')) {
		const emojiForceStd = query.match(/([\w:\.\-@]*) \-f/);
		if (emojiForceStd && emojiForceStd[1]){
			chosen(":" + emojiForceStd[1] + ":")
		}
	}
	if (q2.endsWith('!')) {
		const emojiForceStd = query.match(/([\w:\.\-@]*)!/);
		if (emojiForceStd && emojiForceStd[1]){
			chosen(":" + emojiForceStd[1] + ":")
		}
	}
	if (q2.endsWith(' -f') || q2.endsWith('!')) {
		const q3 = query.replaceAll("( -f|!)$", "");
		const exactMatchCustom = customEmojis.find((emoji) => emoji.name === q3);
		if (exactMatchCustom) {
			chosen(exactMatchCustom);
			return true;
		}
		const exactMatchUnicode = emojilist.find(
			(emoji) => emoji.char === q3 || emoji.name === q3
		);
		if (exactMatchUnicode) {
			chosen(exactMatchUnicode);
			return true;
		}
		if (searchResultCustom.value.length > 0) {
			chosen(searchResultCustom.value[0]);
			return true;
		}
		if (searchResultUnicode.value.length > 0) {
			chosen(searchResultUnicode.value[0]);
			return true;
		}
	}
}

function format_roomaji(
	roomaji: string
): string {
	
	// 絵文字の突き合わせにのみ使うため同じ物として扱われれば
	// それで良いのでafterの方が正しいぞという意味ではないです
	
	// 変換前が2文字
	const replaceDataBefore2 = [
		{before:"fu", after:"hu"},
		{before:"ja", after:"jya"},
		{before:"ju", after:"jyu"},
		{before:"je", after:"jye"},
		{before:"jo", after:"jyo"},
		{before:"fa", after:"fya"},
		{before:"fi", after:"fyi"},
		{before:"fe", after:"fye"},
		{before:"fu", after:"fyu"},
		{before:"fo", after:"fyo"},
		{before:"la", after:"xa"},
		{before:"li", after:"xi"},
		{before:"lu", after:"xu"},
		{before:"le", after:"xe"},
		{before:"lo", after:"xo"},
		{before:"va", after:"ba"},
		{before:"vi", after:"bi"},
		{before:"vu", after:"bu"},
		{before:"ve", after:"be"},
		{before:"vo", after:"bo"},
	]
	
	// 変換前が3文字
	const replaceDataBefore3 = [
		{before:"sha", after:"sya"},
		{before:"shi", after:"syi"},
		{before:"shu", after:"syu"},
		{before:"sho", after:"syo"},
		{before:"thi", after:"ti"},
		{before:"tsu", after:"tu"},
		{before:"kwa", after:"kya"},
		{before:"cya", after:"tya"},
		{before:"cyi", after:"tyi"},
		{before:"cyu", after:"tyu"},
		{before:"cye", after:"tye"},
		{before:"cyo", after:"tyo"},
		{before:"jya", after:"zya"},
		{before:"jyi", after:"zyi"},
		{before:"jyu", after:"zyu"},
		{before:"jye", after:"zye"},
		{before:"jyo", after:"zyo"},
		{before:"ltu", after:"xtu"},
	]
	
	let str = roomaji.toLowerCase()
	if (roomaji.length >= 3){
		replaceDataBefore3.forEach((x) => str = str.replaceAll(x.before,x.after));
	}
	if (roomaji.length >= 2){
		replaceDataBefore2.forEach((x) => str = str.replaceAll(x.before,x.after));
	}
	return str
}

function ja_to_roomaji(
	str: string
): string {
	
	let _str = str;
	
	// ひらがなかカタカナだけでなければ終了
	if (/^[ぁ-んァ-ンー\s]+$/.test(_str)){
		
		const replaceList = [
			{before:"きゃ", after:"kya"},
			{before:"きぃ", after:"kyi"},
			{before:"きゅ", after:"kyu"},
			{before:"きぇ", after:"kye"},
			{before:"きょ", after:"kyo"},
			{before:"しゃ", after:"sya"},
			{before:"しぃ", after:"syi"},
			{before:"しゅ", after:"syu"},
			{before:"しぇ", after:"sye"},
			{before:"しょ", after:"syo"},
			{before:"ちゃ", after:"cha"},
			{before:"ちぃ", after:"chi"},
			{before:"ちゅ", after:"chu"},
			{before:"ちぇ", after:"che"},
			{before:"ちょ", after:"cho"},
			{before:"にゃ", after:"nya"},
			{before:"にぃ", after:"nyi"},
			{before:"にゅ", after:"nyu"},
			{before:"にぇ", after:"nye"},
			{before:"にょ", after:"nyo"},
			{before:"ひゃ", after:"hya"},
			{before:"ひぃ", after:"hyi"},
			{before:"ひゅ", after:"hyu"},
			{before:"ひぇ", after:"hye"},
			{before:"ひょ", after:"hyo"},
			{before:"みゃ", after:"mya"},
			{before:"みぃ", after:"myi"},
			{before:"みゅ", after:"myu"},
			{before:"みぇ", after:"mye"},
			{before:"みょ", after:"myo"},
			{before:"ふぁ", after:"fa"},
			{before:"ふぃ", after:"fi"},
			{before:"ふぇ", after:"fu"},
			{before:"ふょ", after:"fo"},
			{before:"ぎゃ", after:"gya"},
			{before:"ぎぃ", after:"gyi"},
			{before:"ぎゅ", after:"gyu"},
			{before:"ぎぇ", after:"gye"},
			{before:"ぎょ", after:"gyo"},
			{before:"じゃ", after:"zya"},
			{before:"じぃ", after:"zyi"},
			{before:"じゅ", after:"zyu"},
			{before:"じぇ", after:"zye"},
			{before:"じょ", after:"zyo"},
			{before:"ぢゃ", after:"dya"},
			{before:"ぢぃ", after:"dyi"},
			{before:"ぢゅ", after:"dyu"},
			{before:"ぢぇ", after:"dye"},
			{before:"ぢょ", after:"dyo"},
			{before:"びゃ", after:"bya"},
			{before:"びぃ", after:"byi"},
			{before:"びゅ", after:"byu"},
			{before:"びぇ", after:"bye"},
			{before:"びょ", after:"byo"},
			{before:"ぴゃ", after:"pyo"},
			{before:"ぴぃ", after:"pyi"},
			{before:"ぴゅ", after:"pyu"},
			{before:"ぴぇ", after:"pye"},
			{before:"ぴょ", after:"pyo"},
			{before:"ぁ", after:"xa"},
			{before:"あ", after:"a"},
			{before:"ぃ", after:"xi"},
			{before:"い", after:"i"},
			{before:"ぅ", after:"xu"},
			{before:"う", after:"u"},
			{before:"ぇ", after:"xe"},
			{before:"え", after:"e"},
			{before:"ぉ", after:"xo"},
			{before:"お", after:"o"},
			{before:"か", after:"ka"},
			{before:"が", after:"ga"},
			{before:"き", after:"ki"},
			{before:"ぎ", after:"gi"},
			{before:"く", after:"ku"},
			{before:"ぐ", after:"gu"},
			{before:"け", after:"ke"},
			{before:"げ", after:"ge"},
			{before:"こ", after:"ko"},
			{before:"ご", after:"go"},
			{before:"さ", after:"sa"},
			{before:"ざ", after:"za"},
			{before:"し", after:"si"},
			{before:"じ", after:"zi"},
			{before:"す", after:"su"},
			{before:"ず", after:"zu"},
			{before:"せ", after:"se"},
			{before:"ぜ", after:"ze"},
			{before:"そ", after:"so"},
			{before:"ぞ", after:"zo"},
			{before:"た", after:"ta"},
			{before:"だ", after:"da"},
			{before:"ち", after:"ti"},
			{before:"ぢ", after:"di"},
			{before:"つ", after:"tu"},
			{before:"づ", after:"du"},
			{before:"て", after:"te"},
			{before:"で", after:"de"},
			{before:"と", after:"to"},
			{before:"ど", after:"do"},
			{before:"な", after:"na"},
			{before:"に", after:"ni"},
			{before:"ぬ", after:"nu"},
			{before:"ね", after:"ne"},
			{before:"の", after:"no"},
			{before:"は", after:"ha"},
			{before:"ば", after:"ba"},
			{before:"ぱ", after:"pa"},
			{before:"ひ", after:"hi"},
			{before:"び", after:"bi"},
			{before:"ぴ", after:"pi"},
			{before:"ふ", after:"fu"},
			{before:"ぶ", after:"bu"},
			{before:"ぷ", after:"pu"},
			{before:"へ", after:"he"},
			{before:"べ", after:"be"},
			{before:"ぺ", after:"pe"},
			{before:"ほ", after:"ho"},
			{before:"ぼ", after:"bo"},
			{before:"ぽ", after:"po"},
			{before:"ま", after:"ma"},
			{before:"み", after:"mi"},
			{before:"む", after:"mu"},
			{before:"め", after:"me"},
			{before:"も", after:"mo"},
			{before:"ゃ", after:"xya"},
			{before:"や", after:"ya"},
			{before:"ゅ", after:"xyu"},
			{before:"ゆ", after:"yu"},
			{before:"ょ", after:"xyo"},
			{before:"よ", after:"yo"},
			{before:"ら", after:"ra"},
			{before:"り", after:"ri"},
			{before:"る", after:"ru"},
			{before:"れ", after:"re"},
			{before:"ろ", after:"ro"},
			{before:"ゎ", after:"xwa"},
			{before:"わ", after:"wa"},
			{before:"ゐ", after:"i"},
			{before:"ゑ", after:"e"},
			{before:"を", after:"wo"},
			{before:"ん", after:"n"},
			{before:"ー", after:"_"},
			{before:/っ(\w)/g, after:"$1$1"},
			{before:"っ", after:"xtu"},
		];

		_str = kanaToHira(_str);

		replaceList.forEach((x) => _str = _str.replaceAll(x.before,x.after));

	}

	return _str;

}

function kanaToHira(str) {
    return str.replace(/[ァ-ン]/g, function(match) {
        var chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
}

onMounted(() => {
	focus();
});

defineExpose({
	focus,
	reset,
});
</script>

<style lang="scss" scoped>
.omfetrab {
	$pad: 8px;
	display: flex;
	flex-direction: column;
	width: calc(var(--EmojiPickerWidth) + (#{$pad} * 2));
	--EmojiPickerWidth: 95dvw;

	&.s-6 {
		--eachSize: 5px;
		--valign: 0em;
	}

	&.s-5 {
		--eachSize: 10px;
		--valign: 0em;
	}

	&.s-4 {
		--eachSize: 15px;
		--valign: 0em;
	}

	&.s-3 {
		--eachSize: 20px;
		--valign: 0em;
	}

	&.s-2 {
		--eachSize: 25px;
		--valign: 0em;
	}

	&.s-1 {
		--eachSize: 30px;
		--valign: 0em;
	}

	&.s0 {
		--eachSize: 35px;
		--valign: -0.25em;
	}

	&.s1 {
		--eachSize: 40px;
		--valign: -0.25em;
	}

	&.s2 {
		--eachSize: 45px;
		--valign: -0.25em;
	}

	&.s3 {
		--eachSize: 50px;
		--valign: -0.25em;
	}

	&.s4 {
		--eachSize: 55px;
		--valign: -0.25em;
	}

	&.s5 {
		--eachSize: 60px;
		--valign: -0.25em;
	}

	&.s6 {
		--eachSize: 65px;
		--valign: -0.25em;
	}

	&.s7 {
		--eachSize: 70px;
		--valign: -0.25em;
	}

	&.s8 {
		--eachSize: 75px;
		--valign: -0.25em;
	}

	&.s9 {
		--eachSize: 80px;
		--valign: -0.25em;
	}

	&.w-3 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 1);
		--columns: 1fr;
	}

	&.w-2 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 2);
		--columns: 1fr 1fr;
	}

	&.w-1 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 3);
		--columns: 1fr 1fr 1fr;
	}

	&.w0 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 4);
		--columns: 1fr 1fr 1fr 1fr;
	}

	&.w1 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 5);
		--columns: 1fr 1fr 1fr 1fr 1fr;
	}

	&.w2 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 6);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w3 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 7);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w4 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 8);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w5 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 9);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w6 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 10);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w7 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 11);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w8 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 12);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w9 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 13);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w10 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 14);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w11 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 15);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w12 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 16);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w13 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 17);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w14 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 18);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w15 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 19);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.w16 {
		--eachWidth: calc(var(--EmojiPickerWidth) / 20);
		--columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
	}

	&.h1 {
		height: calc((var(--eachSize) * 4) + (#{$pad} * 2));
	}

	&.h2 {
		height: calc((var(--eachSize) * 6) + (#{$pad} * 2));
	}

	&.h3 {
		height: calc((var(--eachSize) * 8) + (#{$pad} * 2));
	}

	&.h4 {
		height: calc((var(--eachSize) * 10) + (#{$pad} * 2));
	}

	&.h5 {
		height: calc((var(--eachSize) * 12) + (#{$pad} * 2));
	}

	&.h6 {
		height: calc((var(--eachSize) * 14) + (#{$pad} * 2));
	}

	&.h7 {
		height: calc((var(--eachSize) * 16) + (#{$pad} * 2));
	}

	&.h8 {
		height: calc((var(--eachSize) * 18) + (#{$pad} * 2));
	}

	&.h9 {
		height: calc((var(--eachSize) * 20) + (#{$pad} * 2));
	}

	&.h10 {
		height: 90dvh;
	}

	&.asDrawer {
		width: 100% !important;
		max-height: 90dvh;
	&

		> .emojis {
			::v-deep(section) {
				> header {
					height: 32px;
					line-height: 32px;
					padding: 0 12px;
					font-size: 15px;
				}

				> .body {
					display: grid;
					grid-template-columns: var(--columns);
					font-size: 30px;

					> .item {
						width: var(--eachWidth);
   						height: var(--eachSize);
						min-width: 0;
					}
				}
			}
		}
	}

	> .search {
		width: 100%;
		padding: 12px;
		box-sizing: border-box;
		font-size: 1em;
		outline: none;
		border: none;
		background: transparent;
		color: var(--fg);

		&:not(.filled) {
			order: 1;
			z-index: 2;
			box-shadow: 0px -1px 0 0px var(--divider);
		}
	}

	> .tabs {
		display: flex;
		display: none;

		> .tab {
			flex: 1;
			height: 38px;
			border-top: solid 0.5px var(--divider);

			&.active {
				border-top: solid 1px var(--accent);
				color: var(--accent);
			}
		}
	}

	> .emojis {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;

		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}

		> .group {
			&:not(.index) {
				padding: 4px 0 8px 0;
				border-top: solid 0.5px var(--divider);
			}

			> header {
				/*position: sticky;
				top: 0;
				left: 0;*/
				height: 32px;
				line-height: 32px;
				z-index: 2;
				padding: 0 8px;
				font-size: 12px;
			}
		}

		::v-deep(section) {
			> header {
				position: sticky;
				top: 0;
				left: 0;
				height: 32px;
				line-height: 32px;
				z-index: 1;
				padding: 0 8px;
				font-size: 12px;
				cursor: pointer;

				&:hover {
					color: var(--accent);
				}
			}

			> .body {
				position: relative;
				padding: $pad;

				> .item {
					position: relative;
					padding: 0;
					width: var(--eachWidth);
					height: var(--eachSize);
					contain: strict;
					border-radius: 4px;
					font-size: 24px;

					&:focus-visible {
						outline: solid 2px var(--focus);
						z-index: 1;
					}

					&:hover {
						background: rgba(0, 0, 0, 0.05);
					}

					&:active {
						background: var(--accent);
						box-shadow: inset 0 0.15em 0.3em rgba(27, 31, 35, 0.15);
					}

					> .emoji {
						max-height: 1.25em;
						height: 90%;
						vertical-align: var(--valign);
						pointer-events: none;
					}
				}
			}

			&.result {
				border-bottom: solid 0.5px var(--divider);
				header {
					height: 32px;
					line-height: 32px;
					z-index: 2;
					padding: 0 8px;
					font-size: 12px;
				}
				&:empty {
					display: none;
				}
			}
		}
	}
}
</style>
