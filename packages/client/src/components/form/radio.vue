<template>
	<div
		v-adaptive-border
		class="novjtctn"
		:class="{ disabled, checked }"
		:aria-checked="checked"
		:aria-disabled="disabled"
		@click="toggle"
	>
		<input type="radio" :disabled="disabled" />
		<span class="button">
			<span></span>
		</span>
		<span class="label"><slot></slot></span>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";

const props = defineProps<{
	modelValue: any;
	value: any;
	disabled: boolean;
}>();

const emit = defineEmits<{
	(ev: "update:modelValue", value: any): void;
}>();

let checked = $computed(() => props.modelValue === props.value);

function toggle(): void {
	if (props.disabled) return;
	emit("update:modelValue", props.value);
}
</script>

<style lang="scss" scoped>
.novjtctn {
	position: relative;
	display: inline-block;
	text-align: left;
	cursor: pointer;
	padding: 0.5rem 0.625rem;
	min-width: 3.75rem;
	background-color: var(--panel);
	background-clip: padding-box !important;
	border: solid 0.0625rem var(--panel);
	border-radius: 0.375rem;
	transition: all 0.2s;

	> * {
		user-select: none;
	}

	&.disabled {
		opacity: 0.6;

		&,
		* {
			cursor: not-allowed !important;
		}
	}

	&:hover {
		border-color: var(--inputBorderHover) !important;
	}
	&:focus-within {
		outline: auto;
	}

	&.checked {
		background-color: var(--accentedBg) !important;
		border-color: var(--accentedBg) !important;
		color: var(--accent);

		&,
		* {
			cursor: default !important;
		}

		> .button {
			border-color: var(--accent);

			&:after {
				background-color: var(--accent);
				transform: scale(1);
				opacity: 1;
			}
		}
	}

	> input {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		margin: 0;
	}

	> .button {
		position: absolute;
		width: 0.875rem;
		height: 0.875rem;
		background: none;
		border: solid 0.125rem var(--inputBorder);
		border-radius: 100%;
		transition: inherit;

		&:after {
			content: "";
			display: block;
			position: absolute;
			top: 0.1875rem;
			right: 0.1875rem;
			bottom: 0.1875rem;
			left: 0.1875rem;
			border-radius: 100%;
			opacity: 0;
			transform: scale(0);
			transition: 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
		}
	}

	> .label {
		margin-left: 1.75rem;
		display: block;
		line-height: 1.25rem;
		cursor: pointer;
	}
}
</style>
