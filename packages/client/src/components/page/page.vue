<template>
	<div
		v-if="!page.isPublic && _err"
		style="white-space: pre-line; font-size: 0.8em; opacity: 0.8"
	>
		{{
			`エラー！${_err}\nJavascriptコンソールにて詳細を出力しています。\n(このメッセージはページが非公開の場合のみ表示されます。)\n\n`
		}}
	</div>

	<!-- Play モード: content 空 + script あり → Ui: API で描画 -->

	<div v-if="isPlayMode && playRoot" class="iroscrza asui-play-root">
		<MkAsUi :component="playRoot" :components="playComponents" />
	</div>

	<!-- ブロックモード: コンテンツブロック + 変数 + 補助 script -->

	<div
		v-else-if="hpml"
		class="iroscrza"
		:class="{ center: page.alignCenter, serif: page.font === 'serif' }"
	>
		<XBlock
			v-for="child in page.content"
			:key="child.id"
			:block="child"
			:hpml="hpml"
			:h="2"
		/>
	</div>
</template>

<script lang="ts">
/**

 * @packageDocumentation

 *

 * ページ本文の描画（ブロックモード / Play モード）。

 *

 * @remarks

 * - Play モード: `content` が空かつ `script` 非空のとき Ui: API で描画

 * - ブロックモード: コンテンツブロック + 変数 + 補助 script（AiScript バージョン自動切替）

 * - プラグインの pageViewInterruptor は描画前に page オブジェクトへ適用する

 *

 * @public

 */

import {
	ref,
	defineComponent,
	onMounted,
	nextTick,
	onUnmounted,
	PropType,
	computed,
} from "vue";

import XBlock from "./page.block.vue";

import MkAsUi from "@/components/MkAsUi.vue";

import { Hpml } from "@/scripts/hpml/evaluator";

import { url } from "@/config";

import { $i } from "@/account";

import { defaultStore, pageViewInterruptors } from "@/store";

import { deepClone } from "@/scripts/clone";

import { isPagePlayMode } from "@/scripts/aiscript/page-mode";

import {
	loadAiscriptRuntime,
	prepareScriptSource,
	resolveAiscriptKind,
} from "@/scripts/aiscript/runtime";

import {
	abortPlayScript,
	createPlayScriptContext,
	runPlayScript,
} from "@/scripts/aiscript/play-runner";

export default defineComponent({
	components: {
		XBlock,

		MkAsUi,
	},

	props: {
		page: {
			type: Object as PropType<Record<string, any>>,

			required: true,
		},
	},

	setup(props) {
		/** プラグイン interruptor 適用後のページ（描画・script 実行に使用） */

		const page = ref(deepClone(props.page));

		const isPlayMode = computed(() => isPagePlayMode(page.value));

		const hpmlOpts = {
			randomSeed: Math.random().toString(),
			visitor: $i,
			url: url,
			enableAiScript: !defaultStore.state.disablePagesScript,
		};

		/** ブロックモードは初回描画を遅らせないため Hpml を同期的に生成する */
		const createHpml = (pageData: Record<string, any>) =>
			isPagePlayMode(pageData) ? null : new Hpml(pageData, hpmlOpts);

		const hpml = ref<Hpml | null>(createHpml(page.value));

		const playCtx = createPlayScriptContext();

		const playRoot = computed(() => playCtx.root.value);

		const playComponents = computed(() => playCtx.components.value);

		const _err = ref("");

		onMounted(() => {
			nextTick(async () => {
				// プラグインが page 表示前に内容を差し替えられるようにする

				if (pageViewInterruptors.length > 0) {
					let result = deepClone(page.value);

					for (const interruptor of pageViewInterruptors) {
						result = await interruptor.handler(result);
					}

					page.value = result;

					if (!isPlayMode.value) {
						hpml.value = createHpml(page.value);
					}
				}

				if (isPlayMode.value) {
					if (!page.value.script?.trim()) return;

					try {
						await runPlayScript(page.value.script, playCtx, {
							storageKey: `pages:${page.value.id}`,

							thisId: page.value.id,

							thisUrl: `${url}/@${page.value.user.username}/pages/${page.value.name}`,

							token: $i?.token,
						});
					} catch (err) {
						console.error(err);

						_err.value += `\n${JSON.stringify(err)}`;
					}

					return;
				}

				const hpmlInstance = hpml.value;

				if (hpmlInstance == null) return;

				const script = page.value.script?.trim();

				if (script && !defaultStore.state.disablePagesScript) {
					try {
						const runtime = await loadAiscriptRuntime(script);

						hpmlInstance.initAiscript(runtime);

						const kind = resolveAiscriptKind(script);

						const source = prepareScriptSource(script, kind);

						const ast = new runtime.Parser().parse(source);

						await hpmlInstance.aiscript!.exec(ast);

						hpmlInstance.eval();
					} catch (err) {
						console.error(err);

						_err.value += `\n${JSON.stringify(err)}`;
					}
				} else {
					hpmlInstance.eval();
				}
			});
		});

		onUnmounted(() => {
			if (isPlayMode.value) {
				abortPlayScript(playCtx);
			} else if (hpml.value?.aiscript) {
				hpml.value.aiscript.abort();
			}
		});

		return {
			page,

			isPlayMode,

			hpml,

			playRoot,

			playComponents,

			_err,
		};
	},
});
</script>

<style lang="scss" scoped>
.iroscrza {
	&.serif {
		> div {
			font-family: serif;
		}
	}

	&.center {
		text-align: center;
	}
}

.asui-play-root {
	display: flex;

	flex-direction: column;

	gap: 0.75rem;
}
</style>
