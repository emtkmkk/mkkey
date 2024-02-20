<template>
	<transition :name="$store.state.animation ? 'zoom' : ''" appear>
		<div class="mjndxjcg">
			<img
				src="/static-assets/badges/error.png"
				class="_ghost"
				alt="Error"
			/>
			<p>
				<i class="ph-warning ph-bold ph-lg"></i>
				{{ i18n.ts.somethingHappened }}
			</p>
			<MkButton class="button" @click="() => $emit('retry')">{{
				i18n.ts.retry
			}}</MkButton>
		</div>
	</transition>
</template>

<script lang="ts" setup>
import MkButton from "@/components/MkButton.vue";
import { i18n } from "@/i18n";
</script>

<style lang="scss" scoped>
.mjndxjcg {
	padding: 2rem;
	text-align: center;

	> p {
		margin: 0 0 0.5rem 0;
	}

	> .button {
		margin: 0 auto;
	}

	> img {
		vertical-align: bottom;
		height: 8rem;
		margin-bottom: 1rem;
		border-radius: 1rem;
	}
}
</style>
