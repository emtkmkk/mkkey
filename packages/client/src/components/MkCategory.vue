<template>
	<div
		v-if="category.contents"
		class="iroscrza emojis"
	>
		<div class="group">
		<XSection
			:key="'custom:' + category.id"
			:initial-shown="true"
			:emojis="
				category.contents
			"
			>{{ category.name }}</XSection
		>
		</div>
	</div>
</template>

<script lang="ts">
import {
	ref,
	toRefs,
	defineComponent,
	onMounted,
	nextTick,
	onUnmounted,
	PropType,
} from "vue";
import { url } from "@/config";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import XSection from "@/components/MkEmojiPicker.section.vue";

export default defineComponent({
	components: {
		XSection,
	},
	props: {
		category: {
			type: Object,
			required: true,
		},
	},
	setup(props) {
		const { category } = toRefs(props);
		return {
			category,
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
.emojis {
	  $pad: 0.5rem;
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;

		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}

		> .group {
			&:not(.index) {
				padding: 0.25rem 0 0.5rem 0;
				border-top: solid 0.03125rem var(--divider);
			}

			> header {
				/*position: sticky;
				top: 0;
				left: 0;*/
				height: 2rem;
				line-height: 2rem;
				z-index: 2;
				padding: 0 0.5rem;
				font-size: 0.75rem;
			}
		}

		::v-deep(section) {
			> header {
				position: sticky;
				top: 0;
				left: 0;
				height: 2rem;
				line-height: 2rem;
				z-index: 1;
				padding: 0 0.5rem;
				font-size: 0.75rem;
				cursor: pointer;

				&:hover {
					color: var(--accent);
				}
			}

			> .body {
				position: relative;
				padding: $pad;

				> .single {
					background: var(--accent);
				}

				> .item {
					position: relative;
					padding: 0;
					width: var(--eachWidth);
					height: var(--eachSize);
					contain: strict;
					border-radius: 0.25rem;
					font-size: 1.5rem;

					&:focus-visible {
						outline: solid 0.125rem var(--focus);
						z-index: 1;
					}

					&:hover {
						background: var(--buttonBg);
					}

					&:active {
						background: var(--accent);
						box-shadow: inset 0 0.15em 0.3em rgba(27, 31, 35, 0.15);
					}

					> .emoji {
						max-height: 1.25em;
						height: 90%;
						vertical-align: var(--valign);
						pointer-events: none;
					}
				}
			}

			&.result {
				border-bottom: solid 0.03125rem var(--divider);
				header {
					height: 2rem;
					line-height: 2rem;
					z-index: 2;
					padding: 0 0.5rem;
					font-size: 0.75rem;
				}
				&:empty {
					display: none;
				}
			}
		}
	}
</style>
