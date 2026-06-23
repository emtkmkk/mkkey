<template>
	<MkModalWindow
		ref="dialog"
		with-ok-button
		:width="520"
		:height="560"
		scroll
		@close="cancel"
		@ok="save"
		@closed="$emit('closed')"
	>
		<template #header>{{ i18n.ts._widgets.aiscriptApp }}</template>
		<div class="_formRoot mk-aiscript-app-widget-settings">
			<FormTextarea v-model="script" tall class="_formBlock">
				<template #label>{{ i18n.ts.script }}</template>
			</FormTextarea>

			<FormSwitch v-model="showHeader" class="_formBlock">
				{{ i18n.ts._widgets.aiscriptAppShowHeader }}
			</FormSwitch>

			<div class="_formBlock">
				<MkButton inline primary @click="run">
					<i class="ph-play ph-bold ph-lg"></i>
					{{ i18n.ts._widgets.aiscriptAppRun }}
				</MkButton>
			</div>

			<div v-if="isSyntaxError" class="syntax-error _formBlock">
				Syntax error :(
			</div>

			<div v-if="playRoot" class="preview _formBlock _panel">
				<MkAsUi :component="playRoot" :components="playComponents" />
			</div>

			<div class="logs _formBlock _monospace">
				<div
					v-for="log in logs"
					:key="log.id"
					class="log"
					:class="{ print: log.print }"
				>
					{{ log.text }}
				</div>
				<div v-if="logs.length === 0" class="log-empty">
					{{ i18n.ts._widgets.aiscriptAppNoLogs }}
				</div>
			</div>
		</div>
	</MkModalWindow>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * aiscriptApp ウィジェットの設定ポップアップ。
 *
 * @remarks
 * script 編集・実行ログ・Ui: プレビューを mkkey 設定 UI（`_formRoot`）で提供する。
 *
 * @public
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { utils } from "@syuilo/aiscript";
import MkModalWindow from "@/components/MkModalWindow.vue";
import MkButton from "@/components/MkButton.vue";
import MkAsUi from "@/components/MkAsUi.vue";
import FormTextarea from "@/components/form/textarea.vue";
import FormSwitch from "@/components/form/switch.vue";
import {
	abortPlayScript,
	createPlayScriptContext,
	runPlayScript,
} from "@/scripts/aiscript/play-runner";
import {
	loadAiscriptRuntime,
	prepareScriptSource,
	resolveAiscriptKind,
} from "@/scripts/aiscript/runtime";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { url } from "@/config";

const props = defineProps<{
	initialScript: string;
	initialShowHeader: boolean;
	widgetId?: string;
}>();

const emit = defineEmits<{
	(ev: "done", value: { script: string; showHeader: boolean }): void;
	(ev: "closed"): void;
}>();

const dialog = ref<InstanceType<typeof MkModalWindow> | null>(null);

let script = $ref(props.initialScript);
let showHeader = $ref(props.initialShowHeader);
const isSyntaxError = ref(false);
const logs = ref<
	{
		id: string;
		text: string;
		print: boolean;
	}[]
>([]);

const playCtx = createPlayScriptContext();
const playRoot = computed(() => playCtx.root.value);
const playComponents = computed(() => playCtx.components.value);

async function run(): Promise<void> {
	isSyntaxError.value = false;
	logs.value = [];

	if (!script.trim()) {
		abortPlayScript(playCtx);
		return;
	}

	try {
		const runtime = await loadAiscriptRuntime(script);
		const kind = resolveAiscriptKind(script);
		const source = prepareScriptSource(script, kind);
		const parser = new runtime.Parser();
		parser.parse(source);
	} catch {
		isSyntaxError.value = true;
		abortPlayScript(playCtx);
		return;
	}

	try {
		await runPlayScript(script, playCtx, {
			storageKey: "widget",
			thisId: props.widgetId ?? "aiscript-app-settings",
			thisUrl: url,
			token: $i?.token,
			out: (value) => {
				logs.value.push({
					id: Math.random().toString(),
					text:
						value.type === "str"
							? String(value.value)
							: utils.valToString(value),
					print: true,
				});
			},
			log: (type, params) => {
				if (type === "end") {
					logs.value.push({
						id: Math.random().toString(),
						text: utils.valToString(params.val as never, true),
						print: false,
					});
				}
			},
		});
	} catch (err: unknown) {
		const e = err as {
			message?: string;
			location?: { start?: { line: number; column: number } };
		};
		const locationStr = e.location?.start
			? `\nLine ${e.location.start.line} : ${e.location.start.column}`
			: "";
		os.alert({
			type: "error",
			title: "AiScript Error",
			text: `${e.message ?? String(err)}${locationStr}`,
		});
	}
}

watch(
	$$(script),
	() => {
		run();
	},
);

onMounted(() => {
	run();
});

onUnmounted(() => {
	abortPlayScript(playCtx);
});

function cancel(): void {
	dialog.value?.close();
}

function save(): void {
	emit("done", { script, showHeader });
	dialog.value?.close();
}
</script>

<style lang="scss" scoped>
.mk-aiscript-app-widget-settings {
	.preview {
		padding: 0.75rem;
	}

	.syntax-error {
		color: var(--error);
		font-size: 0.9em;
	}

	.logs {
		border-top: solid 0.03125rem var(--divider);
		padding-top: 0.75rem;
		max-height: 12rem;
		overflow-y: auto;
		text-align: left;

		> .log {
			&:not(.print) {
				opacity: 0.7;
			}
		}

		> .log-empty {
			opacity: 0.6;
			font-size: 0.9em;
		}
	}
}
</style>
