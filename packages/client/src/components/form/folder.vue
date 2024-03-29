<template>
	<div class="dwzlatin" :class="{ opened }">
		<button class="header _button" @click="toggle">
			<span class="icon"><slot name="icon"></slot></span>
			<span class="text"><slot name="label"></slot></span>
			<span class="right">
				<span class="text"><slot name="suffix"></slot></span>
				<i v-if="opened" class="ph-caret-up ph-bold ph-lg icon"></i>
				<i v-else class="ph-caret-down ph-bold ph-lg icon"></i>
			</span>
		</button>
		<KeepAlive>
			<div v-if="openedAtLeastOnce" v-show="opened" class="body">
				<MkSpacer :margin-min="14" :margin-max="22">
					<slot></slot>
				</MkSpacer>
			</div>
		</KeepAlive>
	</div>
</template>

<script lang="ts" setup>
const props = withDefaults(
	defineProps<{
		defaultOpen: boolean;
	}>(),
	{
		defaultOpen: false,
	}
);

let opened: boolean = $ref(props.defaultOpen);
let openedAtLeastOnce: boolean = $ref(props.defaultOpen);

const toggle = (): void => {
	opened = !opened;
	if (opened) {
		openedAtLeastOnce = true;
	}
};
</script>

<style lang="scss" scoped>
.dwzlatin {
	display: block;

	> .header {
		display: flex;
		align-items: center;
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 0.875rem 0.75rem 0.875rem;
		background: var(--buttonBg);
		border-radius: 0.375rem;

		&:hover {
			text-decoration: none;
			background: var(--buttonHoverBg);
		}

		&.active {
			color: var(--accent);
			background: var(--buttonHoverBg);
		}

		> .icon {
			margin-right: 0.75em;
			flex-shrink: 0;
			text-align: center;
			opacity: 0.8;

			&:empty {
				display: none;

				& + .text {
					padding-left: 0.25rem;
				}
			}
		}

		> .text {
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: hidden;
			padding-right: 0.75rem;
		}

		> .right {
			margin-left: auto;
			opacity: 0.7;
			white-space: nowrap;

			> .text:not(:empty) {
				margin-right: 0.75em;
			}
		}
	}

	> .body {
		background: var(--panel);
		border-radius: 0 0 0.375rem 0.375rem;
	}

	&.opened {
		> .header {
			border-radius: 0.375rem 0.375rem 0 0;
		}
	}
}
</style>
