<template>
	<div>
		<div :class="$style.label"><slot name="label"></slot></div>
		<div :class="[$style.input, { disabled }]">
			<ColorPicker
				ref="inputEl"
				v-model:pureColor="pureColor"
				v-model:gradientColor="gradientColor"
				v-model:activeKey="activeKey"
				v-bind="filteredProps"
				:class="noStyle ? undefined : $style.inputCore"
				:picker-type="pickerType"
				:use-type="useType"
				lang="En"
				:theme="defaultStore.state.darkMode ? 'black' : 'white'"
				><slot></slot
			></ColorPicker>
		</div>
		<div :class="$style.caption"><slot name="caption"></slot></div>
	</div>
</template>

<script lang="ts" setup>
import { ref, shallowRef, toRefs, watch } from "vue";
import { defaultStore } from "@/store";
import { ColorPicker } from "vue3-colorpicker";
import "vue3-colorpicker/style.css";

const props = withDefaults(defineProps<{
	modelValue: string;
	required?: boolean;
	readonly?: boolean;
	disabled?: boolean;
	format?: string;
	pickerType?: string;
	useType?: string;
	noStyle?: boolean;
}>(),
	{
		required: false,
		readonly: false,
		disabled: false,
		format: "hex8",
		pickerType: "chrome",
		useType: "both",
		noStyle: false,
	});

const emit = defineEmits<{
	(ev: "update:modelValue", value: string): void;
}>();

const { modelValue, ...filteredProps } = toRefs(props);
const isGradient =
	modelValue.value &&
	!/^#[0-9A-F]{6}$/i.test(modelValue.value) &&
	!/^#[0-9A-F]{8}$/i.test(modelValue.value);
const pureColor = ref(isGradient ? "" : modelValue.value);
const gradientColor = ref(isGradient ? modelValue.value : "");
const activeKey = ref(isGradient ? "gradient" : "pure");
const inputEl = shallowRef<HTMLElement>();

watch([pureColor, gradientColor, activeKey], () => {
	emit(
		"update:modelValue",
		(activeKey.value === "gradient"
			? gradientColor.value
			: pureColor.value) ?? ""
	);
});
</script>

<style lang="scss" module>
.label {
	font-size: 0.85em;
	padding: 0 0 0.5rem 0;
	user-select: none;

	&:empty {
		display: none;
	}
}

.caption {
	font-size: 0.85em;
	padding: 0.5rem 0 0 0;
	color: var(--fgTransparentWeak);

	&:empty {
		display: none;
	}
}

.input {
	position: relative;

	&.focused {
		> .inputCore {
			border-color: var(--accent) !important;
			//box-shadow: 0 0 0 0.25rem var(--focus);
		}
	}

	&.disabled {
		pointer-events: none;

		&,
		> .inputCore {
			cursor: not-allowed !important;
		}
	}
}

.inputCore {
	appearance: none;
	-webkit-appearance: none;
	display: block;
	height: 2.625rem;
	width: 100%;
	margin: 0;
	padding: 0 0.75rem;
	font: inherit;
	font-weight: normal;
	font-size: 1em;
	color: var(--fg);
	background: var(--panel);
	border: solid 0.0625rem var(--panel);
	border-radius: 0.375rem;
	outline: none;
	box-shadow: none;
	box-sizing: border-box;
	transition: border-color 0.1s ease-out;

	&:hover {
		border-color: var(--inputBorderHover) !important;
	}
}
</style>
