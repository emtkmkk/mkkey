<template>
	<div
		v-if="c.type === 'root'"
		class="asui-root"
		:style="rootStyle"
	>
		<MkAsUi
			v-for="childId in c.children ?? []"
			:key="childId"
			:component="g(childId)"
			:components="components"
			:align="align"
		/>
	</div>

	<div
		v-else-if="c.type === 'container' && !c.hidden"
		class="asui-container"
		:style="containerStyle"
	>
		<MkAsUi
			v-for="childId in c.children ?? []"
			:key="childId"
			:component="g(childId)"
			:components="components"
			:align="containerChildAlign"
		/>
	</div>

	<p
		v-else-if="c.type === 'text'"
		class="asui-text"
		:style="textStyle"
	>
		{{ c.text }}
	</p>

	<div v-else-if="c.type === 'mfm'" class="asui-mfm" :style="textStyle">
		<Mfm :text="c.text ?? ''" :is-note="false" />
	</div>

	<MkButton
		v-else-if="c.type === 'button'"
		inline
		:primary="c.primary"
		:rounded="c.rounded"
		:disabled="c.disabled"
		@click="c.onClick?.()"
	>
		{{ c.text }}
	</MkButton>

	<div
		v-else-if="c.type === 'buttons'"
		class="asui-buttons"
		:style="buttonsStyle"
	>
		<MkButton
			v-for="(button, i) in c.buttons ?? []"
			:key="i"
			inline
			:primary="button.primary"
			:rounded="button.rounded"
			:disabled="button.disabled"
			@click="button.onClick?.()"
		>
			{{ button.text }}
		</MkButton>
	</div>

	<MkSwitch
		v-else-if="c.type === 'switch'"
		:model-value="valueForSwitch"
		@update:model-value="onSwitchUpdate"
	>
		<template v-if="c.label">{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</MkSwitch>

	<MkInput
		v-else-if="c.type === 'textInput'"
		:model-value="valueForTextInput"
		@update:model-value="onTextInputUpdate"
	>
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</MkInput>

	<MkInput
		v-else-if="c.type === 'numberInput'"
		type="number"
		:model-value="valueForNumberInput"
		@update:model-value="onNumberInputUpdate"
	>
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</MkInput>

	<MkTextarea
		v-else-if="c.type === 'textarea'"
		:model-value="valueForTextarea"
		@update:model-value="onTextareaUpdate"
	>
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
	</MkTextarea>

	<MkSelect
		v-else-if="c.type === 'select'"
		:model-value="valueForSelect"
		@update:model-value="onSelectUpdate"
	>
		<template v-if="c.label" #label>{{ c.label }}</template>
		<template v-if="c.caption" #caption>{{ c.caption }}</template>
		<option
			v-for="item in c.items ?? []"
			:key="item.value"
			:value="item.value"
		>
			{{ item.text }}
		</option>
	</MkSelect>

	<MkButton
		v-else-if="c.type === 'postFormButton'"
		inline
		:primary="c.primary"
		:rounded="c.rounded"
		@click="openPostForm"
	>
		{{ c.text }}
	</MkButton>

	<div v-else-if="c.type === 'postForm'" class="asui-postForm">
		<MkPostForm
			:initial-text="c.form?.text ?? ''"
			:initial-visibility="c.form?.visibility"
			:initial-local-only="c.form?.localOnly"
			:instant="true"
			:fixed="true"
		/>
	</div>

	<MkFolder v-else-if="c.type === 'folder'">
		<template #header>{{ c.title }}</template>
		<MkAsUi
			v-for="childId in c.children ?? []"
			:key="childId"
			:component="g(childId)"
			:components="components"
			:align="align"
		/>
	</MkFolder>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * AiScript Ui: コンポーネントツリーを描画する再帰コンポーネント。
 *
 * @remarks
 * Misskey Play 互換の {@link registerAsUiLib} が生成するコンポーネントを Vue UI に変換する。
 * `align` prop はページの中央寄せ設定や Ui:C:container の align を子へ伝播し、
 * flex 子要素（ボタン等）の横位置を決める。
 *
 * @public
 */
import { computed, ref } from "vue";
import type { Ref } from "vue";
import type {
	AsUiComponent,
	AsUiPostFormButton,
	AsUiRoot,
} from "@/scripts/aiscript/ui";
import * as os from "@/os";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkSelect from "@/components/form/select.vue";
import MkFolder from "@/components/MkFolder.vue";
import MkPostForm from "@/components/MkPostForm.vue";

/** 横方向の配置（ページ設定・Ui:C:container 共通） */
type AsUiAlign = "left" | "center" | "right";

const props = withDefaults(
	defineProps<{
		component: AsUiComponent;
		components: Ref<AsUiComponent>[];
		/** ページ中央寄せなど、親から渡される既定の横配置 */
		align?: AsUiAlign;
	}>(),
	{
		align: "left",
	},
);

const c = props.component;
const align = computed(() => props.align);

/** ID からコンポーネント定義を取得（見つからない場合はダミールート） */
function g(id: string): AsUiComponent {
	const v = props.components.find((x) => x.value.id === id)?.value;
	if (v) return v;

	return {
		id: "dummy",
		type: "root",
		children: [],
	} as AsUiRoot;
}

/**
 * align 文字列を flex の cross-axis / main-axis 用値へ変換する
 *
 * @param value - left / center / right
 * @returns flex-start / center / flex-end
 */
function alignToFlex(value: AsUiAlign): string {
	switch (value) {
		case "center":
			return "center";
		case "right":
			return "flex-end";
		default:
			return "flex-start";
	}
}

/** ルートコンテナの flex 横配置（ページ alignCenter の主な適用先） */
const rootStyle = computed(() => {
	if (c.type !== "root") return undefined;

	return {
		alignItems: alignToFlex(align.value),
	};
});

/** container 内の子へ渡す align（スクリプトの align が優先） */
const containerChildAlign = computed((): AsUiAlign => {
	if (c.type !== "container") return align.value;
	return c.align ?? align.value;
});

const containerStyle = computed(() => {
	if (c.type !== "container") return undefined;

	const effectiveAlign = containerChildAlign.value;
	const isBordered = c.borderWidth ?? c.borderColor ?? c.borderStyle;
	const border = isBordered
		? {
				borderWidth: `${c.borderWidth ?? 1}px`,
				borderColor: c.borderColor ?? "var(--divider)",
				borderStyle: c.borderStyle ?? "solid",
			}
		: undefined;

	return {
		textAlign: effectiveAlign,
		alignItems: alignToFlex(effectiveAlign),
		backgroundColor: c.bgColor,
		color: c.fgColor,
		padding: c.padding ? `${c.padding}px` : 0,
		borderRadius: `${c.borderRadius ?? (c.rounded ? 8 : 0)}px`,
		fontFamily:
			c.font === "serif"
				? "serif"
				: c.font === "monospace"
					? "Fira code, Fira Mono, Consolas, Menlo, Courier, monospace"
					: undefined,
		...border,
	};
});

/** 横並びボタン行の main-axis 配置 */
const buttonsStyle = computed(() => ({
	justifyContent: alignToFlex(align.value),
}));

const textStyle = computed(() => {
	if (c.type !== "text" && c.type !== "mfm") return undefined;
	return {
		fontSize: c.size ? `${c.size}px` : undefined,
		fontWeight: c.bold ? "bold" : undefined,
		color: c.color,
		fontFamily:
			c.font === "serif"
				? "serif"
				: c.font === "monospace"
					? "Fira code, Fira Mono, Consolas, Menlo, Courier, monospace"
					: undefined,
	};
});

const valueForSwitch = ref(
	c.type === "switch" && typeof c.default === "boolean" ? c.default : false,
);

function onSwitchUpdate(v: boolean) {
	valueForSwitch.value = v;
	if (c.type === "switch" && c.onChange) {
		void c.onChange(v);
	}
}

const valueForTextInput = ref(
	c.type === "textInput" && c.default != null ? c.default : "",
);

function onTextInputUpdate(v: string | number) {
	valueForTextInput.value = String(v);
	if (c.type === "textInput" && c.onInput) {
		void c.onInput(String(v));
	}
}

const valueForNumberInput = ref(
	c.type === "numberInput" && c.default != null ? c.default : 0,
);

function onNumberInputUpdate(v: string | number) {
	const num = typeof v === "number" ? v : parseFloat(String(v));
	valueForNumberInput.value = num;
	if (c.type === "numberInput" && c.onInput) {
		void c.onInput(num);
	}
}

const valueForTextarea = ref(
	c.type === "textarea" && c.default != null ? c.default : "",
);

function onTextareaUpdate(v: string) {
	valueForTextarea.value = v;
	if (c.type === "textarea" && c.onInput) {
		void c.onInput(v);
	}
}

const valueForSelect = ref(
	c.type === "select" && c.default != null ? c.default : "",
);

function onSelectUpdate(v: string) {
	valueForSelect.value = v;
	if (c.type === "select" && c.onChange) {
		void c.onChange(v);
	}
}

function openPostForm() {
	if (c.type !== "postFormButton") return;
	const form = (c as AsUiPostFormButton).form;
	if (!form) return;

	os.post({
		initialText: form.text,
		initialVisibility: form.visibility,
		initialLocalOnly: form.localOnly,
		instant: true,
	});
}
</script>

<style lang="scss" scoped>
.asui-root {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.asui-container {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.asui-buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.asui-postForm {
	background: var(--panel);
	border-radius: 0.5rem;
}
</style>
