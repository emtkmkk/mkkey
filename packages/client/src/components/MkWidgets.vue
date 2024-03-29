<template>
	<div class="vjoppmmu">
		<template v-if="edit">
			<header tabindex="-1" v-focus>
				<MkSelect
					v-model="widgetAdderSelected"
					style="margin-bottom: var(--margin)"
					class="mk-widget-select"
				>
					<template #label>{{ i18n.ts.selectWidget }}</template>
					<option
						v-for="widget in widgetDefs"
						:key="widget"
						:value="widget"
					>
						{{ i18n.t(`_widgets.${widget}`) }}
					</option>
				</MkSelect>
				<MkButton
					inline
					primary
					class="mk-widget-add"
					@click="addWidget"
					><i class="ph-plus ph-bold ph-lg"></i>
					{{ i18n.ts.add }}</MkButton
				>
				<MkButton inline @click="$emit('exit')">{{
					i18n.ts.close
				}}</MkButton>
			</header>
			<XDraggable
				v-model="widgets_"
				item-key="id"
				handle=".handle"
				animation="150"
			>
				<template #item="{ element }">
					<div class="customize-container">
						<button
							class="config _button"
							@click.prevent.stop="configWidget(element.id)"
						>
							<i class="ph-gear-six ph-bold ph-lg"></i>
						</button>
						<button
							class="remove _button"
							@click.prevent.stop="removeWidget(element)"
						>
							<i class="ph-x ph-bold ph-lg"></i>
						</button>
						<div class="handle">
							<component
								:is="`mkw-${element.name}`"
								:ref="(el) => (widgetRefs[element.id] = el)"
								class="widget"
								:widget="element"
								@updateProps="updateWidget(element.id, $event)"
							/>
						</div>
					</div>
				</template>
			</XDraggable>
		</template>
		<component
			:is="`mkw-${widget.name}`"
			v-for="widget in widgets"
			v-else
			:key="widget.id"
			:ref="(el) => (widgetRefs[widget.id] = el)"
			class="widget"
			:widget="widget"
			@updateProps="updateWidget(widget.id, $event)"
			@contextmenu.stop="onContextmenu(widget, $event)"
		/>
	</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, reactive, ref, computed } from "vue";
import { v4 as uuid } from "uuid";
import MkSelect from "@/components/form/select.vue";
import MkButton from "@/components/MkButton.vue";
import { widgets as widgetDefs } from "@/widgets";
import * as os from "@/os";
import { i18n } from "@/i18n";

const XDraggable = defineAsyncComponent(() => import("vuedraggable"));

type Widget = {
	name: string;
	id: string;
	data: Record<string, any>;
};

const props = defineProps<{
	widgets: Widget[];
	edit: boolean;
}>();

const emit = defineEmits<{
	(ev: "updateWidgets", widgets: Widget[]): void;
	(ev: "addWidget", widget: Widget): void;
	(ev: "removeWidget", widget: Widget): void;
	(ev: "updateWidget", widget: Partial<Widget>): void;
	(ev: "exit"): void;
}>();

const widgetRefs = {};
const configWidget = (id: string) => {
	widgetRefs[id].configure();
};
const widgetAdderSelected = ref(null);
const addWidget = () => {
	if (widgetAdderSelected.value == null) return;

	emit("addWidget", {
		name: widgetAdderSelected.value,
		id: uuid(),
		data: {},
	});

	widgetAdderSelected.value = null;
};
const removeWidget = (widget) => {
	emit("removeWidget", widget);
};
const updateWidget = (id, data) => {
	emit("updateWidget", { id, data });
};
const widgets_ = computed({
	get: () => props.widgets,
	set: (value) => {
		emit("updateWidgets", value);
	},
});

function onContextmenu(widget: Widget, ev: MouseEvent) {
	const isLink = (el: HTMLElement) => {
		if (el.tagName === "A") return true;
		if (el.parentElement) {
			return isLink(el.parentElement);
		}
	};
	if (isLink(ev.target)) return;
	if (
		["INPUT", "TEXTAREA", "IMG", "VIDEO", "CANVAS"].includes(
			ev.target.tagName
		) ||
		ev.target.attributes["contenteditable"]
	)
		return;
	if (window.getSelection()?.toString() !== "") return;

	os.contextMenu(
		[
			{
				type: "label",
				text: i18n.t(`_widgets.${widget.name}`),
			},
			{
				icon: "ph-gear-six ph-bold ph-lg",
				text: i18n.ts.settings,
				action: () => {
					configWidget(widget.id);
				},
			},
			{
				icon: "ph-gear-six ph-bold ph-lg",
				text: "全体設定",
				action: () => {
					props.edit = true;
				},
			},
		],
		ev
	);
}
</script>

<style lang="scss" scoped>
.vjoppmmu {
	> header {
		margin: 1rem 0;

		> * {
			width: 100%;
			padding: 0.25rem;
		}
	}

	> .widget,
	.customize-container {
		contain: content;
		margin: var(--margin) 0;

		&:first-of-type {
			margin-top: 0;
		}
	}

	.customize-container {
		position: relative;
		cursor: move;

		> .config,
		> .remove {
			position: absolute;
			z-index: 10000;
			top: 0.5rem;
			width: 2rem;
			height: 2rem;
			color: #fff;
			background: rgba(#000, 0.7);
			border-radius: 0.25rem;
		}

		> .config {
			right: 0.5rem + 0.5rem + 2rem;
		}

		> .remove {
			right: 0.5rem;
		}

		> .handle {
			> .widget {
				pointer-events: none;
			}
		}
	}
}
</style>
