<template>
	<component
		:is="self && !emojiLink ? 'MkA' : 'a'"
		ref="el"
		class="ieqqeuvs _link"
		:[attr]="self && !emojiLink ? props.url.substring(local.length) : props.url"
		:rel="rel"
		:target="target"
		@contextmenu.stop="() => {}"
		@click.stop="onClick"
	>
		<template v-if="!self">
			<span class="schema">{{ schema }}//</span>
			<span class="hostname">{{ hostname }}</span>
			<span v-if="port != ''" class="port">:{{ port }}</span>
		</template>
		<template v-if="pathname === '/' && self">
			<span class="self">{{ hostname }}</span>
		</template>
		<span v-if="pathname != ''" class="pathname">{{
			self ? pathname.substring(1) : pathname
		}}</span>
		<span class="query">{{ query }}</span>
		<span class="hash">{{ hash }}</span>
		<i
			v-if="target === '_blank'"
			class="ph-arrow-square-out ph-bold ph-lg icon"
		></i>
	</component>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from "vue";
import { toUnicode as decodePunycode } from "punycode/";
import { url as local } from "@/config";
import * as os from "@/os";
import { emojiOfInternalLink, openEmojiDialog } from "@/scripts/open-emoji-dialog";
import { useTooltip } from "@/scripts/use-tooltip";
import { safeURIDecode } from "@/scripts/safe-uri-decode";

const props = defineProps<{
	url: string;
	rel?: string;
}>();

const self = props.url.startsWith(local);
/** もこきーの絵文字の情報の画面の URL なら、その絵文字（押したらページを移動せずダイアログで開く） */
const emojiLink = self ? emojiOfInternalLink(props.url) : null;
const url = new URL(props.url);
if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid url");
const el = ref();

useTooltip(el, (showing) => {
	os.popup(
		defineAsyncComponent(
			() => import("@/components/MkUrlPreviewPopup.vue")
		),
		{
			showing,
			url: props.url,
			source: el.value,
		},
		{},
		"closed"
	);
});

const schema = url.protocol;
const hostname = decodePunycode(url.hostname);
const port = url.port;
const pathname = safeURIDecode(url.pathname);
const query = safeURIDecode(url.search);
const hash = safeURIDecode(url.hash);
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
</script>

<style lang="scss" scoped>
.ieqqeuvs {
	word-break: break-all;

	> .icon {
		padding-left: 0.125rem;
		font-size: 0.9em;
	}

	> .self {
		font-weight: bold;
	}

	> .schema {
		opacity: 0.5;
	}

	> .hostname {
		font-weight: bold;
	}

	> .pathname {
		opacity: 0.8;
	}

	> .query {
		opacity: 0.5;
	}

	> .hash {
		font-style: italic;
	}
}
</style>
