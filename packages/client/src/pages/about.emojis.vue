<template>
	<div class="driuhtrh">
		<div class="query">
			<MkInput
				v-model="q"
				debounce
				class=""
				:placeholder="i18n.ts.search"
			>
				<template #prefix
					><i class="ph-magnifying-glass ph-bold ph-lg"></i
				></template>
			</MkInput>

			<!-- たくさんあると邪魔
		<div class="tags">
			<span class="tag _button" v-for="tag in tags" :class="{ active: selectedTags.has(tag) }" @click="toggleTag(tag)">{{ tag }}</span>
		</div>
		-->
		</div>

		<MkFolder v-if="searchEmojis" class="emojis">
			<template #header>{{ i18n.ts.searchResult }}</template>
			<div class="zuvgdzyt">
				<XEmoji
					v-for="emoji in searchEmojis"
					:key="emoji.name"
					class="emoji"
					:emoji="emoji"
				/>
			</div>
		</MkFolder>

		<MkFolder
			v-for="category in customEmojiCategories"
			:key="category"
			class="emojis"
			:expanded="false"
		>
			<template #header>{{ category || i18n.ts.other }}</template>
			<div class="zuvgdzyt">
				<XEmoji
					v-for="emoji in customEmojis.filter(
						(e) => e.category === category
					)"
					:key="emoji.name"
					class="emoji"
					:emoji="emoji"
				/>
			</div>
		</MkFolder>

		<MkFolder key="category:null" class="emojis" :expanded="false">
			<template #header>{{ "カテゴリ未設定" }}</template>
			<div class="zuvgdzyt">
				<XEmoji
					v-for="emoji in customEmojis.filter((e) => !e.category)"
					:key="emoji.name"
					class="emoji"
					:emoji="emoji"
				/>
			</div>
		</MkFolder>
	</div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import XEmoji from "./emojis.emoji.vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import MkSelect from "@/components/form/select.vue";
import MkFolder from "@/components/MkFolder.vue";
import MkTab from "@/components/MkTab.vue";
import * as os from "@/os";
import { emojiCategories, emojiTags } from "@/instance";
import { i18n } from "@/i18n";

export default defineComponent({
	components: {
		MkButton,
		MkInput,
		MkSelect,
		MkFolder,
		MkTab,
		XEmoji,
	},

	data() {
		return {
			q: "",
			customEmojiCategories: emojiCategories,
			customEmojis: this.$instance.emojis,
			tags: emojiTags,
			selectedTags: new Set(),
			searchEmojis: null,
			i18n,
		};
	},

	watch: {
		q() {
			this.search();
		},
		selectedTags: {
			handler() {
				this.search();
			},
			deep: true,
		},
	},

	methods: {
		search() {
			if (
				(this.q === "" || this.q == null) &&
				this.selectedTags.size === 0
			) {
				this.searchEmojis = null;
				return;
			}

			if (this.selectedTags.size === 0) {
				this.searchEmojis = this.customEmojis.filter(
					(emoji) =>
						emoji.name.includes(this.q) ||
						emoji.aliases.includes(this.q)
				);
			} else {
				this.searchEmojis = this.customEmojis.filter(
					(emoji) =>
						(emoji.name.includes(this.q) ||
							emoji.aliases.includes(this.q)) &&
						[...this.selectedTags].every((t) =>
							emoji.aliases.includes(t)
						)
				);
			}
		},

		toggleTag(tag) {
			if (this.selectedTags.has(tag)) {
				this.selectedTags.delete(tag);
			} else {
				this.selectedTags.add(tag);
			}
		},
	},
});
</script>

<style lang="scss" scoped>
.driuhtrh {
	background: var(--bg);

	> .query {
		background: var(--bg);
		padding: 1rem;

		> .tags {
			> .tag {
				display: inline-block;
				margin: 0.5rem 0.5rem 0 0;
				padding: 0.25rem 0.5rem;
				font-size: 0.9em;
				background: var(--accentedBg);
				border-radius: 0.3125rem;

				&.active {
					background: var(--accent);
					color: var(--fgOnAccent);
				}
			}
		}
	}

	> .emojis {
		--x-padding: 0 1rem;

		.zuvgdzyt {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(11.875rem, 1fr));
			grid-gap: 0.75rem;
			margin: 0 var(--margin) var(--margin) var(--margin);
		}
	}
}
</style>
