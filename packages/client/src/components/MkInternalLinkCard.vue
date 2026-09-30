<template>
	<MkA :to="info.to" :class="$style.root" @click.stop>
		<span :class="$style.icon">
			<MkEmoji v-if="info.kind === 'emoji'" :emoji="info.emoji" normal :class="$style.emoji" />
			<i v-else class="ph-signpost ph-bold ph-lg"></i>
		</span>
		<span :class="$style.body">
			<span :class="$style.label">
				<template v-if="info.kind === 'emoji'">{{ info.emoji }} の情報に移動</template>
				<template v-else>{{ info.label }} に移動</template>
			</span>
			<span :class="$style.path">{{ info.to }}</span>
		</span>
		<i class="ph-caret-right ph-bold" :class="$style.arrow"></i>
	</MkA>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * もこきー自身の URL が投稿に貼られたときに、Web プレビューの代わりに出す「〇〇に移動」の枠。
 *
 * @remarks
 * もこきーの画面の多くは Web プレビュー向けの情報（OGP）を持たず、プレビューを取っても「もこきー」とサーバー全体の説明しか出ない。
 * 代わりに、どの画面かを画面名で示し、押すとアプリ内で移動する。
 * 絵文字の情報の画面は、絵文字の画像と名前を出す。
 * どの URL をこの枠にするかは {@link resolveInternalLink} が決める。
 *
 * @internal
 */
import MkEmoji from "@/components/global/MkEmoji.vue";
import type { InternalLinkInfo } from "@/scripts/internal-link";

defineProps<{
	info: InternalLinkInfo;
}>();
</script>

<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 12px;
	border: solid 1px var(--divider);
	border-radius: 8px;
	color: var(--fg);
	overflow: hidden;

	&:hover {
		text-decoration: none;
		border-color: var(--accent);
	}
}

.icon {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 32px;
	height: 32px;
	color: var(--accent);
}

.emoji {
	height: 32px !important;
	max-width: 96px;
}

.body {
	display: flex;
	flex-direction: column;
	min-width: 0;
	flex: 1;
}

.label {
	font-weight: bold;
	font-size: 0.9em;
	overflow-wrap: anywhere;
}

.path {
	font-size: 0.75em;
	opacity: 0.6;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.arrow {
	flex: none;
	opacity: 0.5;
}
</style>
