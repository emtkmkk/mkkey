<template>
	<MkContainer :show-header="widgetProps.showHeader" class="mkw-aiscriptApp">
		<template #header
			><i class="ph-app-window ph-bold ph-lg"></i
			>{{ i18n.ts._widgets.aiscriptApp }}</template
		>
		<div class="root">
			<div v-if="isSyntaxError">Syntax error :(</div>
			<MkAsUi
				v-else-if="playRoot"
				:component="playRoot"
				:components="playComponents"
			/>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * AiScript の Ui: API を使い簡易 UI アプリを実行するウィジェット。
 *
 * @remarks
 * - {@link runPlayScript} により多バージョン AiScript に対応する
 * - 既存 aiscript ウィジェット（REPL）とは役割が異なる
 * - NOTE: meta に federation フィールドが無い mkkey では連合フィルタは未発動
 *
 * @see {@link runPlayScript}
 * @public
 */
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from "vue";
import {
	useWidgetPropsManager,
	Widget,
	WidgetComponentExpose,
} from "./widget";
import { GetFormResultType } from "@/scripts/form";
import MkContainer from "@/components/MkContainer.vue";
import MkAsUi from "@/components/MkAsUi.vue";
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

const MkAiscriptAppWidgetSettings = defineAsyncComponent(
	() => import("@/components/MkAiscriptAppWidgetSettings.vue"),
);

// #region ウィジェット定義

const name = "aiscriptApp";

const widgetPropsDef = {
	script: {
		type: "string" as const,
		label: i18n.ts.script,
		multiline: true,
		default: "",
	},
	showHeader: {
		type: "boolean" as const,
		default: true,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();

const { widgetProps, save } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit,
);

/** 設定ポップアップ（script / ログ / プレビュー）を開く */
async function configure(): Promise<void> {
	await new Promise<void>((resolve) => {
		os.popup(
			MkAiscriptAppWidgetSettings,
			{
				initialScript: widgetProps.script,
				initialShowHeader: widgetProps.showHeader,
				widgetId: props.widget?.id,
			},
			{
				done: (value: { script: string; showHeader: boolean }) => {
					widgetProps.script = value.script;
					widgetProps.showHeader = value.showHeader;
					save();
					resolve();
				},
				closed: () => resolve(),
			},
			"closed",
		);
	});
}

// #endregion

// #region Play 実行

const playCtx = createPlayScriptContext();
const playRoot = computed(() => playCtx.root.value);
const playComponents = computed(() => playCtx.components.value);
const isSyntaxError = ref(false);

/**
 * スクリプトをパース・実行する。
 *
 * @remarks
 * パースエラーは本家同様にインライン表示、実行エラーは alert する。
 */
async function run() {
	isSyntaxError.value = false;

	if (!widgetProps.script.trim()) {
		abortPlayScript(playCtx);
		return;
	}

	// パースエラーは実行前に検出し、Syntax error 表示にする
	try {
		const runtime = await loadAiscriptRuntime(widgetProps.script);
		const kind = resolveAiscriptKind(widgetProps.script);
		const source = prepareScriptSource(widgetProps.script, kind);
		const parser = new runtime.Parser();
		parser.parse(source);
	} catch {
		isSyntaxError.value = true;
		abortPlayScript(playCtx);
		return;
	}

	try {
		await runPlayScript(widgetProps.script, playCtx, {
			storageKey: "widget",
			thisId: props.widget?.id ?? "aiscript-app",
			thisUrl: url,
			token: $i?.token,
		});
	} catch (err: unknown) {
		const e = err as { message?: string; location?: { start?: { line: number; column: number } } };
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
	() => widgetProps.script,
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

// #endregion

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.mkw-aiscriptApp {
	.root {
		padding: 1rem;
	}
}
</style>
