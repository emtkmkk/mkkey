<template>
	<div class="adhpbeou">
		<div class="label" @click="focus"><slot name="label"></slot></div>
		<div class="content">
			<slot></slot>
		</div>
		<div class="caption"><slot name="caption"></slot></div>
	</div>
</template>

<script lang="ts" setup>
import {} from "vue";

function focus() {
	// TODO
}
</script>

<style lang="scss" scoped>
.adhpbeou {
	> .label {
		font-size: 0.85em;
		padding: 0 0 0.5rem 0;
		user-select: none;

		&:empty {
			display: none;
		}
	}

	> .caption {
		font-size: 0.85em;
		padding: 0.5rem 0 0 0;
		color: var(--fgTransparentWeak);

		&:empty {
			display: none;
		}
	}
}
</style>
