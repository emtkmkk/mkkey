<template>
	<nav class="rrevdjwu" :class="{ grid }">
		<section v-for="group in def" class="group">
			<div v-if="group.title" class="title">{{ group.title }}</div>

			<div class="items">
				<template v-for="(item, i) in group.items">
					<a
						v-if="item.type === 'a'"
						:href="item.href"
						:target="item.target"
						class="_button item"
						:class="{ danger: item.danger, active: item.active }"
					>
						<i
							v-if="item.icon"
							class="icon ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span class="text">{{ item.text }}</span>
					</a>
					<button
						v-else-if="item.type === 'button'"
						class="_button item"
						:class="{ danger: item.danger, active: item.active }"
						:disabled="item.active"
						@click="(ev) => item.action(ev)"
					>
						<i
							v-if="item.icon"
							class="icon ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span class="text">{{ item.text }}</span>
					</button>
					<MkA
						v-else
						:to="item.to"
						class="_button item"
						:class="{ danger: item.danger, active: item.active }"
					>
						<i
							v-if="item.icon"
							class="icon ph-fw ph-lg"
							:class="item.icon"
						></i>
						<span class="text">{{ item.text }}</span>
					</MkA>
				</template>
			</div>
		</section>
	</nav>
</template>

<script lang="ts">
import { defineComponent, ref, unref } from "vue";

export default defineComponent({
	props: {
		def: {
			type: Array,
			required: true,
		},
		grid: {
			type: Boolean,
			required: false,
			default: false,
		},
	},
});
</script>

<style lang="scss" scoped>
.rrevdjwu {
	> .group {
		& + .group {
			margin-top: 1rem;
			padding-top: 1rem;
			border-top: solid 0.03125rem var(--divider);
		}

		> .title {
			opacity: 0.7;
			margin: 0 0 0.5rem 0;
			font-size: 0.9em;
		}

		> .items {
			> .item {
				display: flex;
				align-items: center;
				width: 100%;
				box-sizing: border-box;
				padding: 0.625rem 1rem 0.625rem 0.5rem;
				border-radius: 0.5625rem;
				font-size: 0.9em;
				margin-bottom: 0.3rem;

				&:hover,
				&:focus-visible {
					text-decoration: none;
					background: var(--panelHighlight);
				}

				&.active {
					color: var(--accent);
					background: var(--accentedBg);
				}

				&.danger {
					color: var(--error);
				}

				> .icon {
					width: 2rem;
					margin-right: 0.125rem;
					flex-shrink: 0;
					text-align: center;
					opacity: 0.8;
				}

				> .text {
					white-space: nowrap;
					text-overflow: ellipsis;
					overflow: hidden;
					padding-right: 0.75rem;
				}
			}
		}
	}

	&.grid {
		> .group {
			& + .group {
				padding-top: 0;
				border-top: none;
			}

			margin-left: 0;
			margin-right: 0;

			> .title {
				font-size: 1em;
				opacity: 0.7;
				margin: 0 0 0.5rem 1rem;
			}

			> .items {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(8.125rem, 1fr));
				grid-gap: 0.5rem;
				padding: 0 1rem;

				> .item {
					flex-direction: column;
					padding: 1.125rem 1rem 1rem 1rem;
					background: var(--panel);
					border-radius: 0.5rem;
					text-align: center;

					> .icon {
						display: block;
						margin-right: 0;
						margin-bottom: 0.75rem;
						font-size: 1.5em;
					}

					> .text {
						padding-right: 0;
						width: 100%;
						font-size: 0.8em;
					}
				}
			}
		}
	}
}
</style>
