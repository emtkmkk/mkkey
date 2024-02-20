<template>
	<button
		class="hdcaacmi _button"
		:class="{ wait, active: isFollowing, full }"
		:disabled="wait"
		@click="onClick"
	>
		<template v-if="!wait">
			<template v-if="isFollowing">
				<span v-if="full">{{ i18n.ts.unfollow }}</span
				><i class="ph-minus ph-bold ph-lg"></i>
			</template>
			<template v-else>
				<span v-if="full">{{ i18n.ts.follow }}</span
				><i class="ph-plus ph-bold ph-lg"></i>
			</template>
		</template>
		<template v-else>
			<span v-if="full">{{ i18n.ts.processing }}</span
			><i class="ph-circle-notch ph-bold ph-lg fa-pulse ph-fw ph-lg"></i>
		</template>
	</button>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

const props = withDefaults(
	defineProps<{
		channel: Record<string, any>;
		full?: boolean;
	}>(),
	{
		full: false,
	}
);

const isFollowing = ref<boolean>(props.channel.isFollowing);
const wait = ref(false);

async function onClick() {
	wait.value = true;

	try {
		if (isFollowing.value) {
			await os.api("channels/unfollow", {
				channelId: props.channel.id,
			});
			isFollowing.value = false;
		} else {
			await os.api("channels/follow", {
				channelId: props.channel.id,
			});
			isFollowing.value = true;
		}
	} catch (err) {
		console.error(err);
	} finally {
		wait.value = false;
	}
}
</script>

<style lang="scss" scoped>
.hdcaacmi {
	position: relative;
	display: inline-block;
	font-weight: bold;
	color: var(--accent);
	background: transparent;
	border: solid 0.0625rem var(--accent);
	padding: 0;
	height: 1.9375rem;
	font-size: 1rem;
	border-radius: 2rem;
	background: #fff;

	&.full {
		padding: 0 0.5rem 0 0.75rem;
		font-size: 0.875rem;
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
			border-color: var(--accentDarken);
		}
	}

	&.wait {
		cursor: wait !important;
		opacity: 0.7;
	}

	> span {
		margin-right: 0.375rem;
	}
}
</style>
