<template>
	<div class="cpjygsrt" :class="{ error: error != null, warn: warn != null }">
		<header>
			<div class="title"><slot name="header"></slot></div>
			<div class="buttons">
				<slot name="func"></slot>
				<button v-if="removable" class="_button" @click="remove()">
					<i class="ph-trash ph-bold ph-lg"></i>
				</button>
				<div v-if="draggable" class="drag-handle _button">
					<i class="ph-list ph-bold ph-lg"></i>
				</div>
				<button class="_button" @click="toggleContent(!showBody)">
					<template v-if="showBody"
						><i class="ph-caret-up ph-bold ph-lg"></i
					></template>
					<template v-else
						><i class="ph-caret-down ph-bold ph-lg"></i
					></template>
				</button>
			</div>
		</header>
		<p v-show="showBody" v-if="error != null" class="error">
			{{
				i18n.t("_pages.script.typeError", {
					slot: error.arg + 1,
					expect: i18n.t(`script.types.${error.expect}`),
					actual: i18n.t(`script.types.${error.actual}`),
				})
			}}
		</p>
		<p v-show="showBody" v-if="warn != null" class="warn">
			{{
				i18n.t("_pages.script.thereIsEmptySlot", {
					slot: warn.slot + 1,
				})
			}}
		</p>
		<div v-show="showBody" class="body">
			<slot></slot>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { i18n } from "@/i18n";

export default defineComponent({
	props: {
		expanded: {
			type: Boolean,
			default: true,
		},
		removable: {
			type: Boolean,
			default: true,
		},
		draggable: {
			type: Boolean,
			default: false,
		},
		error: {
			required: false,
			default: null,
		},
		warn: {
			required: false,
			default: null,
		},
	},
	emits: ["toggle", "remove"],
	data() {
		return {
			showBody: this.expanded,
			i18n,
		};
	},
	methods: {
		toggleContent(show: boolean) {
			this.showBody = show;
			this.$emit("toggle", show);
		},
		remove() {
			this.$emit("remove");
		},
	},
});
</script>

<style lang="scss" scoped>
.cpjygsrt {
	position: relative;
	overflow: hidden;
	background: var(--panel);
	border: solid 0.125rem var(--X12);
	border-radius: 0.375rem;

	&:hover {
		border: solid 0.125rem var(--X13);
	}

	&.warn {
		border: solid 0.125rem #f6c177;
	}

	&.error {
		border: solid 0.125rem #eb6f92;
	}

	& + .cpjygsrt {
		margin-top: 1rem;
	}

	> header {
		> .title {
			z-index: 1;
			margin: 0;
			padding: 0 1rem;
			line-height: 2.625rem;
			font-size: 0.9em;
			font-weight: bold;
			box-shadow: 0 0.0625rem rgba(#000, 0.07);

			> i {
				margin-right: 0.375rem;
			}

			&:empty {
				display: none;
			}
		}

		> .buttons {
			position: absolute;
			z-index: 2;
			top: 0;
			right: 0;

			> ._button {
				padding: 0;
				width: 2.625rem;
				font-size: 0.9em;
				line-height: 2.625rem;
			}

			.drag-handle {
				cursor: move;
			}
		}
	}

	> .warn {
		color: #ea9d34;
		margin: 0;
		padding: 1rem 1rem 0 1rem;
		font-size: 0.875rem;
	}

	> .error {
		color: #b4637a;
		margin: 0;
		padding: 1rem 1rem 0 1rem;
		font-size: 0.875rem;
	}

	> .body {
		::v-deep(.juejbjww),
		::v-deep(.eiipwacr) {
			&:not(.inline):first-child {
				margin-top: 1.75rem;
			}

			&:not(.inline):last-child {
				margin-bottom: 1.25rem;
			}
		}
	}
}
</style>
