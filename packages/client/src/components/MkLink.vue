<template>
	<component
		:is="self && !emojiLink ? 'MkA' : 'a'"
		ref="el"
		class="xlcxczvw _link"
		:[attr]="self && !emojiLink ? url.substr(local.length) : url"
		:rel="rel"
		:target="target"
		:title="url"
		@click.stop="onClick"
	>
		<slot></slot>
		<i
			v-if="target === '_blank'"
			class="ph-arrow-square-out ph-bold ph-lg icon"
		></i>
	</component>
</template>

<script lang="ts" setup>
import { defineAsyncComponent } from "vue";
import { url as local } from "@/config";
import { useTooltip } from "@/scripts/use-tooltip";
import * as os from "@/os";
import { emojiOfInternalLink, openEmojiDialog } from "@/scripts/open-emoji-dialog";

const props = withDefaults(
	defineProps<{
		url: string;
		rel?: null | string;
	}>(),
	{}
);

const self = props.url.startsWith(local);
/** もこきーの絵文字の情報の画面の URL なら、その絵文字（押したらページを移動せずダイアログで開く） */
const emojiLink = self ? emojiOfInternalLink(props.url) : null;
const attr = self && !emojiLink ? "to" : "href";
const target = self ? null : "_blank";

/**
 * 押したとき。絵文字の情報の URL だけ、ページを移動せずに絵文字の詳細のダイアログを開く。
 *
 * @param ev - クリック
 */
function onClick(ev: MouseEvent): void {
	if (emojiLink == null) return;
	ev.preventDefault();
	openEmojiDialog(emojiLink);
}

const el = $ref();

useTooltip($$(el), (showing) => {
	os.popup(
		defineAsyncComponent(
			() => import("@/components/MkUrlPreviewPopup.vue")
		),
		{
			showing,
			url: props.url,
			source: el,
		},
		{},
		"closed"
	);
});
</script>

<style lang="scss" scoped>
.xlcxczvw {
	word-break: break-all;

	> .icon {
		padding-left: 0.125rem;
		font-size: 0.9em;
	}
}
</style>
