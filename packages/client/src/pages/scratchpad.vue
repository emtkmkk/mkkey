<template>
	<div class="iltifgqe">
		<div class="editor _panel _gap">
			<PrismEditor
				v-model="code"
				class="_code code"
				style="height: 30vh"
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
import { ref, watch } from "vue";
import "prismjs";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-okaidia.css";
import { PrismEditor } from "vue-prism-editor";
import "vue-prism-editor/dist/prismeditor.min.css";
import { Interpreter, Parser, utils } from "@syuilo/aiscript";
import MkContainer from "@/components/MkContainer.vue";
import MkButton from "@/components/MkButton.vue";
import { createAiScriptEnv } from "@/scripts/aiscript/api";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";

const code = ref("");
const logs = ref<any[]>([]);

const parser = new Parser();

const saved = localStorage.getItem("scratchpad");
if (saved) {
	code.value = saved;
}

watch(code, () => {
	localStorage.setItem("scratchpad", code.value);
});

async function run() {
	logs.value = [];
	const aiscript = new Interpreter(
		createAiScriptEnv({
			storageKey: "scratchpad",
			token: $i?.token,
		}),
		{
			in: (q) => {
				return new Promise((ok) => {
					os.inputText({
						title: q,
					}).then(({ canceled, result: a }) => {
						ok(a);
					});
				});
			},
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
				switch (type) {
					case "end":
						logs.value.push({
							id: Math.random(),
							text: utils.valToString(params.val, true),
							print: false,
						});
						break;
					default:
						break;
				}
			},
		}
	);

	let ast;
	try {
		ast = parser.parse(code.value);
	} catch (err) {
		const locationStr = err.location?.start
			? `\nLine ${err.location.start.line} : ${
					err.location.start.column
			  } (${err.location.start.offset})${
					err.location.start.offset + 1 === err.location.end.offset
						? ""
						: `\n- Line ${err.location.end.line} : ${err.location.end.column} (${err.location.end.offset})`
			  }`
			: "";
		os.alert({
			type: "error",
			text: `Syntax error!${locationStr}${
				err.message ? ` \n${err.message}` : " \nno Message"
			}`,
		});
		return;
	}
	try {
		await aiscript.exec(ast);
	} catch (error: any) {
		os.alert({
			type: "error",
			text: error.message,
		});
	}
}

function highlighter(code) {
	return highlight(code, languages.js, "javascript");
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

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

.bepmlvbi {
	padding: 1rem;

	> .log {
		&:not(.print) {
			opacity: 0.7;
		}
	}
}
</style>
