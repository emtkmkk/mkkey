<template>
	<button
		class="kpoogebi _button"
		:class="{
			active: isActive,
			full,
			large,
		}"
		@click="toggle"
	>
		<template v-if="isActive">
			<span v-if="full">{{ i18n.ts.unfollow }}</span>
			<i class="ph-minus ph-bold ph-lg"></i>
		</template>
		<template v-else>
			<span v-if="full">{{ i18n.ts.follow }}</span>
			<i class="ph-plus ph-bold ph-lg"></i>
		</template>
	</button>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { fetchCustomCategory } from "@/instance";

const emit = defineEmits(["update:active"]);
const props = withDefaults(
	defineProps<{
		categoryId: string;
		initialValue?: boolean;
		large?: boolean;
		full?: boolean;
	}>(),
	{
		initialValue: false,
		large: false,
		full: false,
	}
);

const followCategories = $computed(defaultStore.makeGetterSetter("followCategories"));
const isActive = $ref(props.initialValue);

watch(() => followCategories, () => {
	isActive = followCategories.includes(props.categoryId);
}, { immediate: true });

function toggle() {
       if (isActive) {
               followCategories = followCategories.filter(id => id !== props.categoryId);
       } else {
               followCategories = [...followCategories, props.categoryId];
       }
	isActive = !isActive;
	fetchCustomCategory();
	emit("update:active", isActive);
}

const full = $computed(() => props.full || window.innerWidth < 800);
window.addEventListener('resize', () => full = props.full || window.innerWidth < 800);
</script>

<style lang="scss" scoped>
.kpoogebi {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-weight: bold;
	color: var(--accent);
	border: solid 0.0625rem var(--accent);
	padding: 0;
	height: 1.9375rem;
	font-size: 1rem;
	border-radius: 2rem;
	background: var(--bg);

	&.full {
		padding: 0 0.5rem 0 0.75rem;
		font-size: 0.875rem;
	}

	&.large {
		font-size: 1rem;
		height: 2.375rem;
		padding: 0 0.75rem 0 1rem;
	}

	&:not(.full) {
		width: 1.9375rem;
	}

	&:focus-visible {
		&:after {
			content: "";
			pointer-events: none;
			position: absolute;
			top: -0.3125rem;
			right: -0.3125rem;
			bottom: -0.3125rem;
			left: -0.3125rem;
			border: 0.125rem solid var(--focus);
			border-radius: 2rem;
		}
	}

	&:hover {
		//background: mix($primary, #fff, 20);
	}

	&:active {
		//background: mix($primary, #fff, 40);
	}

	&.active {
		color: #fff;
		background: var(--accent);

		&:hover {
			background: var(--accentLighten);
			border-color: var(--accentLighten);
		}

		&:active {
			background: var(--accentDarken);
			border-color: var (--accentDarken);
		}
	}

	> span {
		margin-right: 0.375rem;
	}
}
</style>
