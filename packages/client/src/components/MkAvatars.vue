<template>
	<div class="defgtij">
		<div v-for="user in users" :key="user.id" class="avatar-holder">
			<MkAvatar :user="user" :show-indicator="true" class="avatar" />
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 * ユーザー一覧のアバターとオンライン状態を定期取得する。
 * @remarks 一覧の差し替えでは取得だけを行い、定期タイマーは一つだけ保持する。
 * @see {@link fetchData}
 * @internal
 */
import { onUnmounted, ref, watch } from "vue";
import * as os from "@/os";

const props = defineProps<{
	userIds: string[];
	sortStatus?: boolean;
	hiddenOfflineSleep?: boolean;
	interval?: number;
}>();

const users = ref([]);
const isFetching = ref(false);
/** 破棄後に遅れて返った取得結果を反映しないための状態。 @internal */
let disposed = false;
onUnmounted(() => { disposed = true; });

/**
 * 現在の一覧を取得する。
 * @remarks 重複取得と、破棄後の結果反映を防止する。
 * @returns 取得完了
 * @internal
 */
const fetchData = async () => {
	if (disposed || isFetching.value) {
		// 処理中は何もしない
		return;
	}

	isFetching.value = true;

	try {
		const _users = (
			await os.api("users/show", {
				userIds: props.userIds,
			})
		).filter((x) =>
			props.hiddenOfflineSleep
				? !(
						x.onlineStatus?.includes("unknown") ||
						x.onlineStatus?.includes("offline") ||
						x.onlineStatus?.includes("sleep")
				  )
				: true
		);

		const onlineStatus = [
			"online",
			"half-online",
			"active",
			"half-active",
			"offline",
			"half-sleeping",
			"sleeping",
			"deep-sleeping",
			"never-sleeping",
			"unknown",
		];

		if (disposed) return;
		users.value = props.sortStatus
			? _users.sort((a, b) =>
					onlineStatus.indexOf(a.onlineStatus) <
					onlineStatus.indexOf(b.onlineStatus)
						? -1
						: onlineStatus.indexOf(a.onlineStatus) ===
						  onlineStatus.indexOf(b.onlineStatus)
						? 0
						: 1
			  )
			: _users;
	} finally {
		isFetching.value = false;
	}
};

// watchの再実行中にライフサイクルフックを登録すると、古いタイマーを解除できない。
// 間隔が変わった場合も、watchのクリーンアップで以前のタイマーを解除する。
watch(() => props.userIds, () => { void fetchData(); }, { immediate: true });
watch(
	() => props.interval || 300 * 1000,
	(interval, _previous, onCleanup) => {
		const intervalId = window.setInterval(() => { void fetchData(); }, interval);
		onCleanup(() => window.clearInterval(intervalId));
	},
	{ immediate: true },
);
</script>

<style lang="scss">
.defgtij {
	padding: 0.75rem;
	grid-gap: 0.75rem;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(1.875rem, 2.5rem));
	place-content: center;

	> .avatar-holder {
		aspect-ratio: 1;

		> .avatar {
			width: 100%;
			height: 100%;
			aspect-ratio: 1;
		}
	}
}
</style>
