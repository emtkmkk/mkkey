<template>
	<aside class="efzpzdvf" :aria-label="i18n.ts._deck._columns.widgets">
		<MkAd class="a" :prefer="['widget']" />
		<XWidgets
			:edit="editMode"
			:widgets="defaultStore.reactiveState.widgets.value"
			@add-widget="addWidget"
			@remove-widget="removeWidget"
			@update-widget="updateWidget"
			@update-widgets="updateWidgets"
			@exit="editMode = false"
		/>
		<button
			v-if="editMode"
			class="_textButton"
			style="font-size: 0.9em"
			@click="editMode = false"
		>
			<i class="ph-check ph-bold ph-lg"></i> {{ i18n.ts.editWidgetsExit }}
		</button>
		<button
			v-else
			class="_textButton mk-widget-edit"
			style="font-size: 0.9em"
			@click="editMode = true"
		>
			<i class="ph-pencil ph-bold ph-lg"></i> {{ i18n.ts.editWidgets }}
		</button>
	</aside>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import XWidgets from "@/components/MkWidgets.vue";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";

const emit = defineEmits<{
	(ev: "mounted", el: Element): void;
}>();

let editMode = $ref(false);
let rootEl = $ref<HTMLDivElement>();

onMounted(() => {
	emit("mounted", rootEl);
});

function addWidget(widget) {
	defaultStore.set("widgets", [
		{
			...widget,
			place: null,
		},
		...defaultStore.state.widgets,
	]);
}

function removeWidget(widget) {
	defaultStore.set(
		"widgets",
		defaultStore.state.widgets.filter((w) => w.id !== widget.id)
	);
}

function updateWidget({ id, data }) {
	defaultStore.set(
		"widgets",
		defaultStore.state.widgets.map((w) =>
			w.id === id
				? {
						...w,
						data,
				  }
				: w
		)
	);
}

function updateWidgets(widgets) {
	defaultStore.set("widgets", widgets);
}
</script>

<style lang="scss" scoped>
.efzpzdvf {
	position: sticky;
	height: min-content;
	min-height: 100vh;
	padding: var(--margin) 0;
	box-sizing: border-box;

	> * {
		margin: var(--margin) 0;
		width: 18.75rem;

		&:first-child {
			margin-top: 0;
		}
	}

	> .add {
		margin: 0 auto;
	}
}
</style>
