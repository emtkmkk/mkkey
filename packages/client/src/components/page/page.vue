<template>
	<div
		v-if="!page.isPublic && _err"
		style="white-space: pre-line; font-size: 0.8em; opacity: 0.8"
	>
		{{
			`エラー！${_err}\nJavascriptコンソールにて詳細を出力しています。\n(このメッセージはページが非公開の場合のみ表示されます。)\n\n`
		}}
	</div>
	<div
		v-if="hpml"
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
import {
	ref,
	defineComponent,
	onMounted,
	nextTick,
	onUnmounted,
	PropType,
} from "vue";
import { Parser } from "@syuilo/aiscript";
import XBlock from "./page.block.vue";
import { Hpml } from "@/scripts/hpml/evaluator";
import { url } from "@/config";
import { $i } from "@/account";
import { defaultStore } from "@/store";

export default defineComponent({
	components: {
		XBlock,
	},
	props: {
		page: {
			type: Object as PropType<Record<string, any>>,
			required: true,
		},
	},
	setup(props, ctx) {
		const hpml = new Hpml(props.page, {
			randomSeed: Math.random(),
			visitor: $i,
			url: url,
			enableAiScript: !defaultStore.state.disablePagesScript,
		});

		let _err = ref("");

		const parser = new Parser();

		onMounted(() => {
			nextTick(() => {
				if (props.page.script && hpml.aiscript) {
					let ast;
					try {
						ast = parser.parse(props.page.script);
					} catch (err) {
						console.error(err);
						_err.value += `\n${JSON.stringify(err)}`;
						return;
					}
					hpml.aiscript
						.exec(ast)
						.then(() => {
							hpml.eval();
						})
						.catch((err) => {
							console.error(err);
							_err.value += `\n${JSON.stringify(err)}`;
						});
				} else {
					hpml.eval();
				}
			});
			onUnmounted(() => {
				if (hpml.aiscript) hpml.aiscript.abort();
			});
		});

		return {
			hpml,
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
</style>
