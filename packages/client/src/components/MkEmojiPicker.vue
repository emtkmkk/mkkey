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
					<div v-if="!allCustomEmojis && q && q.includes('@')">
						<header class="_acrylic">{{ (props.asReactionPicker || $store.state.showRemoteEmojiPostForm) ? "他サーバー絵文字の取得に失敗した為、使用出来ません。" : "@（他鯖絵文字検索）はリアクション時のみ使用可能です。" }}</header>
					</div>
					<div v-else>
						<header class="_acrylic" v-if="!(q == null || q === '')">
							{{ `${q.includes('@') ? (remoteEmojiMode === "all" ? "他サーバー絵文字検索 " : "他サーバー絵文字検索(ミニ) ") : "検索結果 "}
							${!(waitingFlg || searchingFlg) ? (searchResultCustomStart.length + searchResultUnicodeStart.length + searchResultCustom.length + searchResultUnicode.length) !== 0 
								? `${(searchResultCustomStart.length + searchResultUnicodeStart.length) + " / " + (searchResultCustom.length + searchResultUnicode.length)} 件` 
								: "0 件" : searchingFlg ? "検索中……" : "入力待機中……" }${allCustomEmojis && !q.includes('@') ? " (@で他サーバー絵文字検索)" : ""}
							` }}
						</header>
					</div>
					<div v-if="searchResultCustomStart.length > 0" class="body">
						<template v-for="emoji in searchResultCustomStart">
							<button
								:key="emoji.id"
								v-if="!errorEmojis.has(':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':')"
								class="_button item"
								v-tooltip="':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':'"
								:title="emoji.name + (emoji.host ? '@' + emoji.host : '')"
								tabindex="0"
								@click="chosen(emoji, $event)"
							>
								<MkEmoji
									class="emoji"
									:emoji="':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':'"
									:normal="true"
									:isPicker="true"
									@loaderror="errorEmojis.add(':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':')"
								/>
								<!--<img
									class="emoji"
									:src="
										disableShowingAnimatedImages
											? getStaticImageUrl(emoji.url)
											: emoji.url
									"
								/>-->
							</button>
						</template>
					</div>
					<div v-if="searchResultUnicodeStart.length > 0" class="body">
						<button
							v-for="emoji in searchResultUnicodeStart"
							:key="emoji.name"
							class="_button item"
							v-tooltip="emoji.name"
							:title="emoji.name"
							tabindex="0"
							@click="chosen(emoji, $event)"
						>
							<MkEmoji class="emoji" :emoji="emoji.char" />
						</button>
					</div>
					<div v-if="searchResultCustom.length > 0" class="body">
						<template v-for="emoji in searchResultCustom">
							<button
								:key="emoji.id"
								v-if="!errorEmojis.has(':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':')"
								class="_button item"
								v-tooltip="':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':'"
								:title="emoji.name + (emoji.host ? '@' + emoji.host : '')"
								tabindex="0"
								@click="chosen(emoji, $event)"
							>
								<MkEmoji
									class="emoji"
									:emoji="':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':'"
									:normal="true"
									:isPicker="true"
									@loaderror="errorEmojis.add(':' + emoji.name + (emoji.host ? '@' + emoji.host : '') + ':')"
								/>
								<!--<img
									class="emoji"
									:src="
										disableShowingAnimatedImages
											? getStaticImageUrl(emoji.url)
											: emoji.url
									"
								/>-->
							</button>
						</template>
					</div>
					<div v-if="searchResultUnicode.length > 0" class="body">
						<button
							v-for="emoji in searchResultUnicode"
							:key="emoji.name"
							class="_button item"
							v-tooltip="emoji.name"
							:title="emoji.name"
							tabindex="0"
							@click="chosen(emoji, $event)"
						>
							<MkEmoji class="emoji" :emoji="emoji.char" />
						</button>
					</div>
				</section>

				<div v-if="!$store.state.hiddenReactionDeckAndRecent && tab === 'index' && searchResultCustom.length <= 0 && (q == null || q === '')" class="group index">
					<template v-if="!showPinned || ((pinned2?.length ?? 0) + (pinned3?.length ?? 0) + (pinned4?.length ?? 0) + (pinned5?.length ?? 0)) === 0">
						<section v-if="showPinned">
							<div class="body">
								<template v-for="emoji in pinned.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))">
									<button
										:key="emoji"
										v-if="!errorEmojis.has(emoji)"
										v-tooltip="emoji"
										class="_button item"
										tabindex="0"
										@click="chosen(emoji, $event)"
									>
										<MkEmoji class="emoji" :emoji="emoji" :normal="true" :isPicker="true" @loaderror="errorEmojis.add(emoji)"/>
									</button>
								</template>
							</div>
						</section>
						
						<section v-if="!showPinned && !$store.state.hiddenRecent && recentlyMostUsed?.length">
							<header class="_acrylic">
								<i class="ph-alarm ph-bold ph-fw ph-lg"></i>
								{{ i18n.ts.recentlyMostUsed }}
							</header>
							<div class="body">
								<template v-for="emoji in recentlyMostUsed?.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))">
									<button
										:key="emoji"
										v-if="!errorEmojis.has(emoji)"
										v-tooltip="emoji"
										class="_button item"
										@click="chosen(emoji, $event)"
									>
										<MkEmoji class="emoji" :emoji="emoji" :normal="true" :isPicker="true" @loaderror="errorEmojis.add(emoji)"/>
									</button>
								</template>
							</div>
						</section>

						<section v-if="!$store.state.hiddenRecent">
							<header class="_acrylic">
								<i class="ph-alarm ph-bold ph-fw ph-lg"></i>
								{{ i18n.ts.recentUsed }}
							</header>
							<div class="body">
								<template v-for="emoji in recentlyUsedEmojis.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))">
									<button
										:key="emoji"
										v-if="!errorEmojis.has(emoji)"
										v-tooltip="emoji"
										class="_button item"
										@click="chosen(emoji, $event)"
									>
										<MkEmoji class="emoji" :emoji="emoji" :normal="true" :isPicker="true" @loaderror="errorEmojis.add(emoji)"/>
									</button>
								</template>
							</div>
						</section>
					</template>
					<template v-else>
						<XSection
							key="pinned:1"
							v-if="pinned?.length != 0"
							:initial-shown="$store.state.reactionsDefaultOpen"
							:emojis="
								pinned.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))
							"
							@chosen="chosen"
							>{{ ($store.state.reactionsFolderName || "ピン留め絵文字 : 1") + " " }}</XSection
						>
						<XSection
							key="pinned:2"
							v-if="pinned2?.length != 0"
							:initial-shown="$store.state.reactions2DefaultOpen"
							:emojis="
								pinned2.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))
							"
							@chosen="chosen"
							>{{ ($store.state.reactionsFolderName2 || "ピン留め絵文字 : 2") + " " }}</XSection
						>
						<XSection
							v-if="pinned3?.length != 0"
							key="pinned:3"
							:initial-shown="$store.state.reactions3DefaultOpen"
							:emojis="
								pinned3.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))
							"
							@chosen="chosen"
							>{{ ($store.state.reactionsFolderName3 || "ピン留め絵文字 : 3") + " " }}</XSection
						>
						<XSection
							v-if="pinned4?.length != 0"
							key="pinned:4"
							:initial-shown="$store.state.reactions4DefaultOpen"
							:emojis="
								pinned4.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))
							"
							@chosen="chosen"
							>{{ ($store.state.reactionsFolderName4 || "ピン留め絵文字 : 4") + " " }}</XSection
						>
						<XSection
							v-if="pinned5?.length != 0"
							key="pinned:5"
							:initial-shown="$store.state.reactions5DefaultOpen"
							:emojis="
								pinned5.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))
							"
							@chosen="chosen"
							>{{ ($store.state.reactionsFolderName5 || "ピン留め絵文字 : 5") + " " }}</XSection
						>
						<XSection
							v-if="recentlyUsedEmojis?.length != 0 && !$store.state.hiddenRecent"
							key="recentlyUsed"
							:initial-shown="$store.state.recentlyUsedDefaultOpen"
							:emojis="
								recentlyUsedEmojis.filter((x) => ((props.asReactionPicker || $store.state.showRemoteEmojiPostForm) && emojiStr && emojiStr.includes(x)) || !x.includes('@'))
							"
							@chosen="chosen"
							>{{ i18n.ts.recentUsed }}</XSection
						>
					</template>
				</div>
				<div v-once v-if="searchResultCustom.length <= 0 && (q == null || q === '')" class="group">
					<header>{{ i18n.ts.customEmojis }}</header>
					<XSection
						key="custom:recentlyAddEmojis"
						:initial-shown="false"
						:emojis="
							customEmojis
								.filter((e) => e.createdAt ? new Date().valueOf() - new Date(e.createdAt).valueOf() < 7 * 24 * 60 * 60 * 1000 : false)
								.sort((a,b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf())
								.slice(0,255)
								.map((e) => ':' + e.name + ':')
						"
						@chosen="chosen"
						>{{ i18n.ts.recentlyAddEmojis }}</XSection
					>
					<XSection
						key="custom:random"
						:initial-shown="false"
						:emojis="
							randomSubset.map((e) => ':' + e.name + ':')
						"
						@chosen="chosen"
						>{{ i18n.ts.random }}</XSection
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
									.filter((e) => !e.category && /^[aiueo]/i.test(formatRoomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(0,1).toLowerCase()) - sortWord.indexOf(b.name?.slice(0,1).toLowerCase()))
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
									.filter((e) => !e.category && /^[kg]([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => ['k','g'].indexOf(a.name?.slice(0,1).toLowerCase()) - ['k','g'].indexOf(b.name?.slice(0,1).toLowerCase()))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^[sz]([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => ['s','z'].indexOf(a.name?.slice(0,1).toLowerCase()) - ['s','z'].indexOf(b.name?.slice(0,1).toLowerCase()))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^[td]([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => ['t','d'].indexOf(a.name?.slice(0,1).toLowerCase()) - ['t','d'].indexOf(b.name?.slice(0,1).toLowerCase()))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^n([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^[hfbp]([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => ['h','f','b','p'].indexOf(a.name?.slice(0,1).toLowerCase()) - ['h','f','b','p'].indexOf(b.name?.slice(0,1).toLowerCase()))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^m([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^[y]([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^[r]([aiueo]|y[aiueo])/i.test(formatRoomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
									.filter((e) => !e.category && /^([w]([aiueo]|y[aiueo])|n([^aiueoy]))/i.test(formatRoomaji(e.name)))
									.sort((a,b) => sortWord.indexOf(a.name?.slice(1,2).toLowerCase()) - sortWord.indexOf(b.name?.slice(1,2).toLowerCase()))
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
				<div v-once v-if="searchResultCustom.length <= 0 && (q == null || q === '')" class="group">
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
import { ref, unref, computed, watch, onMounted } from "vue";
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
import { formatRoomaji, kanaToHira, jaToRoomaji } from "@/scripts/convert-jp";
import { emojiCategories, instance } from "@/instance";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { FocusTrap } from "focus-trap-vue";
import { $i } from "@/account";

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
	reactions2: pinned2,
	reactions3: pinned3,
	reactions4: pinned4,
	reactions5: pinned5,
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
const customEmojis = computed(() => 
	instance.emojis
);
let allCustomEmojis = computed(() => 
	(props.asReactionPicker || defaultStore.state.showRemoteEmojiPostForm) ? instance.allEmojis : undefined
);
const remoteEmojiMode = computed(() => 
	instance.remoteEmojiMode
);
const emojiStr = computed(() => 
	(props.asReactionPicker || defaultStore.state.showRemoteEmojiPostForm) && unref(allCustomEmojis) ? unref(allCustomEmojis).map((x) => ":" + x.name + "@" + x.host + ":") : undefined
);
const randomSubset = computed(() => {
	let copy = [...unref(customEmojis)];
	let result = [];
	for (let i = 0; i < 99; ++i) {
		const randomIndex = Math.floor(Math.random() * copy.length);
		const [item] = copy.splice(randomIndex, 1);
		result.push(item);
	}
	return result;
});
const recentlyMostUsed = computed(async () => {
	if (!instance.emojiStats) {
		const _emojiStats = await os.api("users/emoji-stats", {
			userId: $i.id,
			limit: 80,
		});

		instance.emojiStats = _emojiStats;
	}
	return instance.emojiStats.recentlySentReactions.map((x) => x.name).filter((x) => !pinned.value.includes(key) && !pinned2.value.includes(key) && !pinned3.value.includes(key) && !pinned4.value.includes(key) && !pinned5.value.includes(key)).slice(0,50);
})
const q = ref<string | null>(null);
const errorEmojis = ref(new Set());
const searchResultCustom = ref<Misskey.entities.CustomEmoji[]>([]);
const searchResultCustomStart = ref<Misskey.entities.CustomEmoji[]>([]);
const searchResultUnicode = ref<UnicodeEmojiDef[]>([]);
const searchResultUnicodeStart = ref<UnicodeEmojiDef[]>([]);
const tab = ref<"index" | "custom" | "unicode" | "tags">("index");
const sortWord = ["a","i","u","e","o","y"];
let singleTapTime = undefined;
let singleTapEmoji = undefined;
let singleTapEl = undefined;

let waitingFlg = ref(false);
let searchingFlg = ref(false);
let debounceTimer;

watch(q, (nQ, oQ) => {
	clearTimeout(debounceTimer);
	
	waitingFlg.value = true;
	
	let searchInstant = false;
	if (q.value.includes("*")) {
		q.value = oQ;
	}
	if (oQ?.includes("*")){
		searchInstant = true;
	}
	if (q.value.includes("＠")) q.value = nQ.replaceAll("＠","@");
	
	const enableInstanceEmojiSearch = defaultStore.state.enableInstanceEmojiSearch;
	
	if (!nQ || (!enableInstanceEmojiSearch && (oQ + "@" === nQ || nQ + "@" === oQ))) searchInstant = true;
	
	let waitTime;
	
	if (!searchInstant && nQ?.length + 1 === oQ?.length && nQ + "@" !== oQ) {
		// 1文字消しただけで消した文字が@じゃない場合は次の更新まで1.2秒待つ
		// ただし@が入っている場合は2秒待つ
		waitTime = nQ.includes("@") ? 2000 : 1200;
	} else if (searchInstant) {
		// ユーザから即時検索を要求された場合、全文字が消えた場合
		// ホスト名検索が無効で@が足されたり消されたりした場合は即時検索
		waitTime = 0;
	} else if (enableInstanceEmojiSearch && nQ.includes("@")) {
		// ホスト名検索が有効で@が入力されている場合は少し遅めの0.6秒にする
		waitTime = 600;
	} else {
		// すべてに当てはまらない場合は0.4秒
		waitTime = 400;
	}
	
	debounceTimer = setTimeout(() => {
		searchingFlg.value = true;
		waitingFlg.value = false;
		emojiSearch(nQ, oQ); 
	}, waitTime);
});

function emojiSearch(nQ, oQ) {
	if (!defaultStore.state.enableInstanceEmojiSearch && nQ.includes("@") && !nQ.endsWith("@")) q.value = nQ.replaceAll("@","").replace("*","") + "@";

	if (emojis.value) emojis.value.scrollTop = 0;
	
	if (q.value == null || q.value.replace(/[:@]/g,"") === "") {
		searchResultCustom.value = [];
		searchResultCustomStart.value = [];
		searchResultUnicode.value = [];
		searchResultUnicodeStart.value = [];
		searchingFlg.value = false;
		return;
	}
	
	if ((nQ.endsWith('!'))) {
		searchingFlg.value = false;
		return;
	}
	
	
	let searchHost = undefined;
	
	if (nQ.includes("@") && defaultStore.state.enableInstanceEmojiSearch) {
		// ホスト名絞り込み
		searchHost = /@(\S+?):?$/.exec(q.value)?.[1];
	}

	const isAllSearch = unref(allCustomEmojis) ? q.value.includes("@") : false;
	const newQ = kanaToHira(formatRoomaji(q.value.replace(/@\S*$|:/g, "")));
	const roomajiQ = formatRoomaji(jaToRoomaji(q.value.replace(/@\S*$|:/g, "")));
	
	const searchCustom = () => {
		const max = isAllSearch ? 45 : 99;
		const emojis = unref(customEmojis);
		const allEmojis = unref(allCustomEmojis);
		const matches = new Set<Misskey.entities.CustomEmoji>();
		
		// 設定で無効にされている場合は即終了
		if (isAllSearch && defaultStore.state.disableAllIncludesSearch) return matches;

		if (newQ.includes(" ")) {
			// AND検索
			const keywords = newQ.split(" ");
			const roomajiKeywords = roomajiQ.split(" ");

			// 名前またはエイリアスにキーワードが含まれている
			if (isAllSearch) {
				for (const emoji of allEmojis) {
					if (searchHost && !emoji.host.includes(searchHost)) continue;
					if (
						keywords.every(
							(keyword) =>
								formatRoomaji(emoji.name).includes(roomajiKeywords)
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
								formatRoomaji(emoji.name).includes(roomajiKeywords) ||
								emoji.aliases.some((alias) =>
									formatRoomaji(alias).includes(keyword)
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
					if (keywords.every((keyword) => formatRoomaji(emoji.name).includes(roomajiKeywords))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
				
			}
		} else {
			if (isAllSearch) {
				for (const emoji of allEmojis) {
					if (searchHost && !emoji.host.includes(searchHost)) continue;
					if (!formatRoomaji(emoji.name).startsWith(roomajiQ)) {
						if (formatRoomaji(emoji.name).includes(roomajiQ)) {
							matches.add(emoji);
							if (matches.size >= max) break;
						}
					}
				}
				if (matches.size >= max) return matches;
			} else {
				for (const emoji of emojis) {
					if (!formatRoomaji(emoji.name).startsWith(roomajiQ)) {
						if (formatRoomaji(emoji.name).includes(roomajiQ)) {
							matches.add(emoji);
							if (matches.size >= max) break;
						}
					}
				}
				if (matches.size >= max) return matches;

				for (const emoji of emojis) {
					if (!emoji.aliases.some((alias) => kanaToHira(formatRoomaji(alias)).startsWith(newQ))) {
						if (emoji.aliases.some((alias) => kanaToHira(formatRoomaji(alias)).includes(newQ))) {
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
		const emojis = unref(customEmojis);
		const allEmojis = unref(allCustomEmojis);
		const matches = new Set<Misskey.entities.CustomEmoji>();
		const beforeSort = new Set();

		if (newQ.includes(" ")) {
			// AND検索
			return matches;
		} else {
			if (isAllSearch) {
				for (const emoji of allEmojis) {
					if (searchHost && !emoji.host.includes(searchHost)) continue;
					if (formatRoomaji(emoji.name).startsWith(roomajiQ)) {
						if (beforeSort.size >= max) break;
						beforeSort.add({
							emoji: emoji,
							key: formatRoomaji(emoji.name),
						});
					}
				}
			} else {
				const exactMatch = emojis.find((emoji) => emoji.name === roomajiQ);
				if (exactMatch) beforeSort.add({emoji: exactMatch,key: formatRoomaji(exactMatch.name),});
				for (const emoji of emojis) {
					if (formatRoomaji(emoji.name).startsWith(roomajiQ)) {
						if (beforeSort.size >= max) break;
						beforeSort.add({
							emoji: emoji,
							key: formatRoomaji(emoji.name),
						});
					}
				}

				emojifor : for (const emoji of emojis) {
					for (const alias of emoji.aliases) {
						if (kanaToHira(formatRoomaji(alias)).startsWith(newQ)) {
							if (beforeSort.size >= max) break emojifor;
							beforeSort.add({
								emoji: emoji,
								key: formatRoomaji(alias),
							});
						}
					}
				}
			}
		}

		return new Set(Array.from(beforeSort).sort((a, b) => a.key.length - b.key.length).map((x) => x.emoji));
	};
	
	const searchUnicode = () => {
		const max = 30;
		const emojis = emojilist;
		const matches = new Set<UnicodeEmojiDef>();
		
		if (isAllSearch) return matches;
		if (newQ.includes(" ")) {
			// AND検索
			const keywords = newQ.split(" ");
			const roomajiKeywords = roomajiQ.split(" ");

			// 名前にキーワードが含まれている
			for (const emoji of emojis) {
				if (keywords.every((keyword) => formatRoomaji(emoji.name).includes(roomajiKeywords))) {
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
							formatRoomaji(emoji.name).includes(roomajiKeywords) ||
							emoji.keywords.some((alias) =>
								formatRoomaji(alias).includes(keyword)
							)
					)
				) {
					matches.add(emoji);
					if (matches.size >= max) break;
				}
			}
		} else {
			for (const emoji of emojis) {
				if (!formatRoomaji(emoji.name).startsWith(roomajiQ)) {
					if (formatRoomaji(emoji.name).includes(roomajiQ)) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}
			if (matches.size >= max) return matches;

			for (const emoji of emojis) {
				if (
					!emoji.keywords.some((keyword) => formatRoomaji(keyword).startsWith(roomajiQ))
				) {
					if (emoji.keywords.some((keyword) => formatRoomaji(keyword).includes(roomajiQ))) {
						matches.add(emoji);
						if (matches.size >= max) break;
					}
				}
			}
		}

		return matches;
	};
	
	const searchUnicodeStart = () => {
		const max = 45;
		const emojis = emojilist;
		const matches = new Set<UnicodeEmojiDef>();
		const beforeSort = new Set();

		if (isAllSearch) return matches;
		const exactMatch = emojis.find((emoji) => formatRoomaji(emoji.name) === roomajiQ);
		if (exactMatch) beforeSort.add({emoji: exactMatch,key: formatRoomaji(exactMatch.name),});

		if (newQ.includes(" ")) {
			// AND検索
			return matches;
		} else {
			for (const emoji of emojis) {
				if (formatRoomaji(emoji.name).startsWith(roomajiQ)) {
					if (beforeSort.size >= max) break;
					beforeSort.add({
						emoji: emoji,
						key: formatRoomaji(emoji.name),
					});
				}
			}

			emojifor : for (const emoji of emojis) {
				for (const keyword of emoji.keywords) {
					if (
						formatRoomaji(keyword).startsWith(roomajiQ)
					) {
						if (beforeSort.size >= max) break emojifor;
						beforeSort.add({
							emoji: emoji,
							key: formatRoomaji(keyword),
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
	
	searchingFlg.value = false;

}

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
		//誤爆防止ダブルタップリアクション機能
		if (props.asReactionPicker && props.showPinned && defaultStore.state.doubleTapReaction){
			if (!singleTapTime || singleTapEmoji !== emoji || (Date.now() - singleTapTime) > 2 * 1000){
				singleTapTime = Date.now();
				singleTapEmoji = emoji;
				
				if (singleTapEl) {
					singleTapEl.style.transition = '';
					singleTapEl.style.backgroundColor = 'transparent';
				}
				singleTapEl = el;
				
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
		const rect = el.getBoundingClientRect();
		const x = rect.left + el.offsetWidth / 2;
		const y = rect.top + el.offsetHeight / 2;
		os.popup(Ripple, { x, y }, {}, "end");
	}

	const key = getKey(emoji);
	emit("chosen", key);

	// 最近使った絵文字更新
	if (!pinned.value.includes(key) && !pinned2.value.includes(key) && !pinned3.value.includes(key) && !pinned4.value.includes(key) && !pinned5.value.includes(key)) {
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
			return true;
		}
	}
	if (q2.endsWith('!')) {
		const emojiForceStd = query.match(/([\w:\.\-@]*)!/);
		if (emojiForceStd && emojiForceStd[1]){
			chosen(":" + emojiForceStd[1] + ":")
			return true;
		}
	}
	const exactMatchUnicode = emojilist.find(
		(emoji) => emoji.char === q2
	);
	if (exactMatchUnicode) {
		chosen(exactMatchUnicode);
		return true;
	}
	if (q2.endsWith(' -f') || q2.endsWith('!')) {
		const q3 = query.replace(/( -f|!)$/, "");
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
	} else {
		q.value = query + "*";
	}
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
		
		&:not(:focus):not(.filled) {
			margin-bottom: env(safe-area-inset-bottom, 0px);
		}
		
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

				> .single {
					background: var(--accent);
				}
				
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
