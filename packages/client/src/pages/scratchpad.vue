<template>
	<div class="iltifgqe">
		<div class="editor _panel _gap">
			<PrismEditor
				v-model="code"
				class="_code code"
				style="height: calc(var(--vh, 1vh) * 30)"
				:highlight="highlighter"
				:line-numbers="false"
			/>
			<MkButton
				style="position: absolute; top: 0.5rem; right: 0.5rem"
				primary
				@click="run()"
				><i class="ph-play ph-bold ph-lg"></i
			></MkButton>
		</div>

		<MkContainer v-if="playRoot" :foldable="true" class="_gap">
			<template #header>{{ i18n.ts.scratchpadPlayUi }}</template>
			<div class="asui-preview">
				<MkAsUi :component="playRoot" :components="playComponents" />
			</div>
		</MkContainer>

		<MkContainer :foldable="true" class="_gap">
			<template #header>{{ i18n.ts.output }}</template>
			<div class="bepmlvbi">
				<div
					v-for="log in logs"
					:key="log.id"
					class="log"
					:class="{ print: log.print }"
				>
					{{ log.text }}
				</div>
			</div>
		</MkContainer>

		<div class="_gap">
			{{ i18n.ts.scratchpadDescription }}
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * AiScript スクラッチパッド。Play 互換の Ui: プレビューも提供する。
 *
 * @remarks
 * - `Ui:render` を使うスクリプトはプレビュー領域に描画される
 * - `print` / `<:` の出力は従来どおりテキストログに表示
 *
 * @public
 */
import { ref, watch, computed, onUnmounted } from "vue";
import "prismjs";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-okaidia.css";
import { PrismEditor } from "vue-prism-editor";
import "vue-prism-editor/dist/prismeditor.min.css";
import { utils } from "@syuilo/aiscript";
import MkContainer from "@/components/MkContainer.vue";
import MkButton from "@/components/MkButton.vue";
import MkAsUi from "@/components/MkAsUi.vue";
import {
	abortPlayScript,
	createPlayScriptContext,
	runPlayScript,
} from "@/scripts/aiscript/play-runner";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { url } from "@/config";

const code = ref("");
const logs = ref<
	{
		id: number;
		text: string;
		print: boolean;
	}[]
>([]);
const playCtx = createPlayScriptContext();
const playRoot = computed(() => playCtx.root.value);
const playComponents = computed(() => playCtx.components.value);

const saved = localStorage.getItem("scratchpad");
if (saved) {
	code.value = saved;
}

watch(code, () => {
	localStorage.setItem("scratchpad", code.value);
});

onUnmounted(() => {
	abortPlayScript(playCtx);
});

async function run() {
	logs.value = [];

	try {
		await runPlayScript(code.value, playCtx, {
			storageKey: "scratchpad",
			thisId: "scratchpad",
			thisUrl: url,
			token: $i?.token,
			out: (value) => {
				logs.value.push({
					id: Math.random(),
					text:
						value.type === "str"
							? value.value
							: utils.valToString(value),
					print: true,
				});
			},
			log: (type, params) => {
				if (type === "end") {
					logs.value.push({
						id: Math.random(),
						text: utils.valToString(params.val as never, true),
						print: false,
					});
				}
			},
		});
	} catch (err: any) {
		const locationStr = err.location?.start
			? `\nLine ${err.location.start.line} : ${err.location.start.column}`
			: "";
		os.alert({
			type: "error",
			text: `${err.message ?? String(err)}${locationStr}`,
		});
	}
}

function highlighter(code: string) {
	return highlight(code, languages.js, "javascript");
}

definePageMetadata({
	title: i18n.ts.scratchpad,
	icon: "ph-terminal-window ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
.iltifgqe {
	padding: 1rem;

	> .editor {
		position: relative;
	}
}

.asui-preview {
	padding: 1rem;
}

.bepmlvbi {
	padding: 1rem;

	> .log {
		&:not(.print) {
			opacity: 0.7;
		}
	}
}
</style>
