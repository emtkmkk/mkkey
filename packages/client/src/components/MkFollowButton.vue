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
/**
 * @packageDocumentation
 *
 * ユーザーのフォロー／フォローリクエスト／ブロック解除ボタン。
 *
 * @remarks
 * API 応答と WebSocket（follow / unfollow）の双方で relation を同期する。
 * 親の user オブジェクトも更新し、プロフィール全体の表示と揃える。
 *
 * @public
 */
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import type * as Misskey from "calckey-js";
import * as os from "@/os";
import { stream } from "@/stream";
import { i18n } from "@/i18n";
import { $i } from "@/account";
import * as config from "@/config";
import {
	ackFollowReconfirmAfterFollow,
	clearFollowReconfirmFlags,
	confirmFollowReconfirmIfNeeded,
} from "@/scripts/follow-reconfirm";

/** users/show 等から受け取る relation 更新用フィールド */
type UserRelationPatch = Pick<
	Misskey.entities.UserDetailed,
	| "id"
	| "isFollowing"
	| "isFollowed"
	| "hasPendingFollowRequestFromYou"
	| "isBlocking"
	| "isMuted"
	| "needsFollowReconfirm"
	| "followReconfirmReason"
>;

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
	},
);

const isBlocking = computed(() => $i != null && props.user.isBlocking === true);

let isFollowing = $ref($i != null && props.user.isFollowing === true);
let hasPendingFollowRequestFromYou = $ref(
	$i != null && props.user.hasPendingFollowRequestFromYou === true,
);
let wait = $ref(false);
const connection = stream.useChannel("main");

/**
 * props.user の relation をローカル state に反映する。
 */
function syncLocalFromProps(): void {
	if ($i == null) return;
	isFollowing = props.user.isFollowing === true;
	hasPendingFollowRequestFromYou =
		props.user.hasPendingFollowRequestFromYou === true;
}

/**
 * API / ストリーム由来の relation を props.user とローカル state に書き戻す。
 *
 * @param packed 対象ユーザー（followee）の pack 結果
 */
function applyRelationFromPacked(packed: UserRelationPatch): void {
	if (packed.id !== props.user.id) return;

	if (packed.isFollowing != null) {
		props.user.isFollowing = packed.isFollowing;
		isFollowing = packed.isFollowing;
	}
	if (packed.hasPendingFollowRequestFromYou != null) {
		props.user.hasPendingFollowRequestFromYou =
			packed.hasPendingFollowRequestFromYou;
		hasPendingFollowRequestFromYou = packed.hasPendingFollowRequestFromYou;
	}
	if (packed.isFollowed != null) {
		props.user.isFollowed = packed.isFollowed;
	}
	if (packed.isBlocking != null) {
		props.user.isBlocking = packed.isBlocking;
	}
	if (packed.isMuted != null) {
		props.user.isMuted = packed.isMuted;
	}
	if (packed.needsFollowReconfirm != null) {
		props.user.needsFollowReconfirm = packed.needsFollowReconfirm;
	}
	if (packed.followReconfirmReason !== undefined) {
		props.user.followReconfirmReason = packed.followReconfirmReason;
	}
}

if ($i != null && props.user.isFollowing == null) {
	os.api("users/show", {
		userId: props.user.id,
	}).then(applyRelationFromPacked);
}

watch(
	() => [
		props.user.isFollowing,
		props.user.hasPendingFollowRequestFromYou,
		props.user.isBlocking,
	],
	syncLocalFromProps,
);

function onFollowChange(user: Misskey.entities.UserDetailed): void {
	applyRelationFromPacked(user);
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
				"_blank",
			);
		} else {
			window.open(
				`https://${input.trim()}/@${props.user.username}@${hostname}`,
				"_blank",
			);
		}

		return;
	}
	wait = true;

	try {
		if (isBlocking.value) {
			const { canceled } = await os.confirm({
				type: "warning",
				text: i18n.t("unblockConfirm"),
			});
			if (canceled) return;

			const packed = await os.api("blocking/delete", {
				userId: props.user.id,
			});
			applyRelationFromPacked(packed);
			if (props.user.isMuted) {
				await os.api("mute/delete", {
					userId: props.user.id,
				});
				props.user.isMuted = false;
			}
		} else if (isFollowing) {
			const { canceled } = await os.confirm({
				type: "warning",
				text: i18n.t("unfollowConfirm", {
					name: props.user.name || props.user.username,
				}),
			});

			if (canceled) return;

			const packed = await os.api("following/delete", {
				userId: props.user.id,
			});
			applyRelationFromPacked(packed);
		} else if (hasPendingFollowRequestFromYou) {
			const packed = await os.api("following/requests/cancel", {
				userId: props.user.id,
			});
			applyRelationFromPacked(packed);
		} else {
			const hadFollowReconfirm = props.user.needsFollowReconfirm === true;

			if (!(await confirmFollowReconfirmIfNeeded(props.user))) {
				return;
			}

			if (props.user.isSilenced) {
				const { canceled } = await os.confirm({
					type: "warning",
					text: i18n.t("silencedUserFollowConfirm"),
				});

				if (canceled) return;
			}

			if (props.user.isModerationWarning) {
				const { canceled } = await os.confirm({
					type: "warning",
					text: i18n.t("warnedUserFollowConfirm"),
					wait: 7,
				});

				if (canceled) return;
			}

			const packed = await os.api("following/create", {
				userId: props.user.id,
			});
			applyRelationFromPacked(packed);
			if (hadFollowReconfirm) {
				const acked = await ackFollowReconfirmAfterFollow(props.user.id);
				if (acked != null) {
					applyRelationFromPacked(acked);
				} else {
					clearFollowReconfirmFlags(props.user);
				}
			}
		}
	} catch (err) {
		console.error(err);
	} finally {
		wait = false;
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
	background: var(--bg) !important;
	border: none;
}
</style>
