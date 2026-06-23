<template>
	<template v-if="c.type === 'root'">
		<MkAsUi
			v-for="childId in c.children ?? []"
			:key="childId"
			:component="g(childId)"
			:components="components"
		/>
	</template>

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
		:primary="c.primary"
		:rounded="c.rounded"
		:disabled="c.disabled"
		@click="c.onClick?.()"
	>
		{{ c.text }}
	</MkButton>

	<div v-else-if="c.type === 'buttons'" class="asui-buttons">
		<MkButton
			v-for="(button, i) in c.buttons ?? []"
			:key="i"
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

const props = defineProps<{
	component: AsUiComponent;
	components: Ref<AsUiComponent>[];
}>();

const c = props.component;

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

const containerStyle = computed(() => {
	if (c.type !== "container") return undefined;

	const isBordered = c.borderWidth ?? c.borderColor ?? c.borderStyle;
	const border = isBordered
		? {
				borderWidth: `${c.borderWidth ?? 1}px`,
				borderColor: c.borderColor ?? "var(--divider)",
				borderStyle: c.borderStyle ?? "solid",
			}
		: undefined;

	return {
		textAlign: c.align,
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
