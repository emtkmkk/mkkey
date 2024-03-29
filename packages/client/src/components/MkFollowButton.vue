<template>
	<button
		class="kpoogebi _button"
		:class="{
			wait,
			active: isFollowing || hasPendingFollowRequestFromYou,
			full,
			large,
			blocking: isBlocking,
		}"
		:disabled="wait"
		v-if="!(isFollowing && isFollowingHidden)"
		@click="onClick"
	>
		<template v-if="!wait">
			<template v-if="isBlocking">
				<span v-if="full">{{ i18n.ts.blocked }}</span
				><i class="ph-prohibit ph-bold ph-lg"></i>
			</template>
			<template v-else-if="hasPendingFollowRequestFromYou">
				<span v-if="full">{{ i18n.ts.followRequestPending }}</span
				><i class="ph-hourglass-medium ph-bold ph-lg"></i>
			</template>
			<template v-else-if="isFollowing && !isFollowingHidden">
				<span v-if="full">{{ i18n.ts.unfollow }}</span
				><i class="ph-minus ph-bold ph-lg"></i>
			</template>
			<template v-else-if="!$i">
				<span v-if="full">{{ i18n.ts.followRequest }}</span
				><i class="ph-plus ph-bold ph-lg"></i>
			</template>
			<template v-else-if="!isFollowing && user.isLocked">
				<span v-if="full">{{ i18n.ts.followRequest }}</span
				><i class="ph-plus ph-bold ph-lg"></i>
			</template>
			<template v-else-if="!isFollowing && !user.isLocked">
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
import { computed, onBeforeUnmount, onMounted } from "vue";
import type * as Misskey from "calckey-js";
import * as os from "@/os";
import { stream } from "@/stream";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import * as config from "@/config";

const emit = defineEmits(["refresh"]);
const props = withDefaults(
	defineProps<{
		user: Misskey.entities.UserDetailed;
		full?: boolean;
		large?: boolean;
		isFollowingHidden?: boolean;
	}>(),
	{
		full: false,
		large: false,
		isFollowingHidden: false,
	}
);

const isBlocking = computed(() => $i != null && props.user.isBlocking);

let isFollowing = $ref($i != null && props.user.isFollowing);
let hasPendingFollowRequestFromYou = $ref(
	$i != null && props.user.hasPendingFollowRequestFromYou
);
let wait = $ref(false);
const connection = stream.useChannel("main");

if ($i != null && props.user.isFollowing == null) {
	os.api("users/show", {
		userId: props.user.id,
	}).then(onFollowChange);
}

function onFollowChange(user: Misskey.entities.UserDetailed) {
	if (user.id === props.user.id) {
		isFollowing = user.isFollowing;
		hasPendingFollowRequestFromYou = user.hasPendingFollowRequestFromYou;
	}
}

async function onClick() {
	if ($i == null) {
		const hostname = props.user.host ?? config.host;

		const { canceled, result: input } = await os.inputText({
			title: i18n.ts.hostnameInput,
			text: `または、照会機能にて\n「<plain>@${props.user.username}@${hostname}</plain>」\nを入力してください。\n`,
			placeholder: i18n.ts.hostnameInputPlaceholder,
		});
		if (
			canceled ||
			!input ||
			input.trim() === config.host ||
			!/^[\w.-]+$/.test(input)
		) {
			return;
		}

		if (input.trim() === hostname) {
			window.open(
				`https://${input.trim()}/@${props.user.username}`,
				"_blank"
			);
		} else {
			window.open(
				`https://${input.trim()}/@${props.user.username}@${hostname}`,
				"_blank"
			);
		}

		return;
	} else {
		wait = true;

		try {
			if (isBlocking.value) {
				const { canceled } = await os.confirm({
					type: "warning",
					text: i18n.t("unblockConfirm"),
				});
				if (canceled) return;

				await os.api("blocking/delete", {
					userId: props.user.id,
				});
				if (props.user.isMuted) {
					await os.api("mute/delete", {
						userId: props.user.id,
					});
				}
				emit("refresh");
			} else if (isFollowing) {
				const { canceled } = await os.confirm({
					type: "warning",
					text: i18n.t("unfollowConfirm", {
						name: props.user.name || props.user.username,
					}),
				});

				if (canceled) return;

				await os.api("following/delete", {
					userId: props.user.id,
				});
			} else {
				if (hasPendingFollowRequestFromYou) {
					await os.api("following/requests/cancel", {
						userId: props.user.id,
					});
					hasPendingFollowRequestFromYou = false;
				} else {
					await os.api("following/create", {
						userId: props.user.id,
					});
					hasPendingFollowRequestFromYou = true;
				}
			}
		} catch (err) {
			console.error(err);
		} finally {
			wait = false;
		}
	}
}

onMounted(() => {
	connection.on("follow", onFollowChange);
	connection.on("unfollow", onFollowChange);
});

onBeforeUnmount(() => {
	connection.dispose();
});
</script>

<style lang="scss" scoped>
.kpoogebi {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-weight: bold;
	color: var(--accent);
	border: solid 0.0625rem var(--accent);
	padding: 0;
	height: 1.9375rem;
	font-size: 1rem;
	border-radius: 2rem;
	background: var(--bg);

	&.full {
		padding: 0 0.5rem 0 0.75rem;
		font-size: 0.875rem;
	}

	&.large {
		font-size: 1rem;
		height: 2.375rem;
		padding: 0 0.75rem 0 1rem;
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

.blocking {
	background-color: var(--bg) !important;
	border: none;
}
</style>
