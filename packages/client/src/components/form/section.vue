<template>
	<section class="vrtktovh _formBlock">
		<h3 class="label"><slot name="label"></slot></h3>
		<div class="main _formRoot">
			<slot></slot>
		</div>
	</section>
</template>

<script lang="ts" setup></script>

<style lang="scss" scoped>
.vrtktovh {
	border-top: solid 0.0.3125rem var(--divider);
	border-bottom: solid 0.0.3125rem var(--divider);

	& + .vrtktovh {
		border-top: none;
	}

	&:first-child {
		border-top: none;
	}

	&:last-child {
		border-bottom: none;
	}

	> .label {
		font-weight: bold;
		margin: 1.5em 0 1rem 0;
		font-size: 1em;

		&:empty {
			display: none;
		}
	}

	> .main {
		margin: 1.5em 0;
	}
}
</style>
