<template>
	<button
		v-if="defaultStore.state.favButtonReaction !== 'hidden'"
		v-tooltip.noDelay.bottom="
			defaultStore.state.favButtonReaction === 'favorite'
				? i18n.ts.favorite
				: defaultStore.state.favButtonReaction === 'custom'
				? defaultStore.state.favButtonReactionCustom
				: i18n.ts._gallery.like
		"
		class="_button"
		:class="$style.root"
		ref="buttonRef"
		@click="toggleStar($event)"
	>
		<span v-if="!effectiveReacted">
			<i
				v-if="instance.defaultReaction === '👍'"
				class="ph-thumbs-up ph-bold ph-lg"
			></i>
			<i
				v-else-if="instance.defaultReaction === '❤️'"
				class="ph-heart ph-bold ph-lg"
			></i>
			<i v-else class="ph-star ph-bold ph-lg"></i>
		</span>
		<span v-else>
			<i
				v-if="instance.defaultReaction === '👍'"
				class="ph-thumbs-up ph-bold ph-lg ph-fill"
				:class="$style.yellow"
			></i>
			<i
				v-else-if="instance.defaultReaction === '❤️'"
				class="ph-heart ph-bold ph-lg ph-fill"
				:class="$style.red"
			></i>
			<i
				v-else
				class="ph-star ph-bold ph-lg ph-fill"
				:class="$style.yellow"
			></i>
		</span>
		<template v-if="count > 0"
			><p :class="$style.count">{{ count }}</p></template
		>
	</button>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { Note } from "calckey-js/built/entities";
import Ripple from "@/components/MkRipple.vue";
import XDetails from "@/components/MkUsersTooltip.vue";
import { pleaseLogin } from "@/scripts/please-login";
import * as os from "@/os";
import { $i } from "@/account";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { instance } from "@/instance";
import { useTooltip } from "@/scripts/use-tooltip";
import { reactionPicker } from "@/scripts/reaction-picker";
import * as sound from "@/scripts/sound.js";

const props = defineProps<{
	note: Note;
	count: number;
	reacted: boolean;
	hasPickerButton?: boolean; // ピッカーボタンも表示されているか（1ボタン/2ボタン判定用）
	isReactionListVisible?: boolean; // リアクション一覧が表示されているか
}>();

const buttonRef = ref<HTMLElement>();

// favoriteモードでは「reacted」の意味は無関係で、実際の非公開お気に入り状態を別途保持する
const isFavorited = ref(false);

/**
 * favoriteモード時のみ、notes/state からお気に入り状態を取得する。
 *
 * @internal
 */
async function fetchFavoritedState(): Promise<void> {
	if (!$i || defaultStore.state.favButtonReaction !== "favorite") return;
	try {
		const state = await os.api("notes/state", { noteId: props.note.id });
		isFavorited.value = state.isFavorited;
	} catch {
		// 取得失敗時は見た目上のみ非お気に入り扱い（実際の状態には影響しない）
	}
}

fetchFavoritedState();

watch(
	() => defaultStore.state.favButtonReaction,
	(mode) => {
		if (mode === "favorite") fetchFavoritedState();
	},
);

/** ボタンの点灯状態。favoriteモードは実際のお気に入り状態、それ以外はデフォルトリアクション済みか */
const effectiveReacted = computed(() =>
	defaultStore.state.favButtonReaction === "favorite"
		? isFavorited.value
		: props.reacted,
);

function popRipple(ev?: MouseEvent): void {
	const el =
		ev &&
		((ev.currentTarget ?? ev.target) as HTMLElement | null | undefined);
	if (!el) return;
	const rect = el.getBoundingClientRect();
	const x = rect.left + el.offsetWidth / 2;
	const y = rect.top + el.offsetHeight / 2;
	os.popup(Ripple, { x, y }, {}, "end");
}

/**
 * favoriteモード用の真のトグル。お気に入り済みなら delete、未お気に入りなら create を呼ぶ。
 *
 * @internal
 */
async function toggleFavorite(ev?: MouseEvent): Promise<void> {
	const nextFavorited = !isFavorited.value;
	isFavorited.value = nextFavorited;
	try {
		await os.api(
			nextFavorited ? "notes/favorites/create" : "notes/favorites/delete",
			{ noteId: props.note.id },
		);
	} catch (err: any) {
		// 失敗時は表示を元に戻す
		isFavorited.value = !nextFavorited;
		os.alert({
			type: "error",
			text: `${err?.message}\n${err?.id}`,
		});
		return;
	}
	if (nextFavorited) popRipple(ev);
}

function toggleStar(ev?: MouseEvent): void {
	pleaseLogin();

	if (defaultStore.state.favButtonReaction === "favorite") {
		void toggleFavorite(ev);
		return;
	}

	if (!props.reacted) {
		if (defaultStore.state.favButtonReaction === "picker") {
			reactionPicker.show(
				buttonRef.value,
				(reaction) => {
					os.api("notes/reactions/create", {
						noteId: props.note.id,
						reaction: reaction,
					}).then(() => {
						sound.play("reaction");
					});
				},
				() => {},
			);
		} else {
			os.api("notes/reactions/create", {
				noteId: props.note.id,
				reaction:
					defaultStore.state.woozyMode === true
						? "🥴"
						: defaultStore.state.favButtonReaction === "custom"
						? defaultStore.state.favButtonReactionCustom
						: defaultStore.state.favButtonReaction === ""
						? instance.defaultReaction
						: defaultStore.state.favButtonReaction,
			}).then(() => {
				sound.play("reaction");
			});
		}
		popRipple(ev);
	} else {
		os.api("notes/reactions/delete", {
			noteId: props.note.id,
			reaction: instance.defaultReaction,
		});
	}
}

useTooltip(buttonRef, async (showing) => {
	// favoriteモードは非公開の個人ブックマークなので、リアクション者一覧は表示しない
	if (defaultStore.state.favButtonReaction === "favorite") return;

	// 2ボタンの場合: 常にデフォルトリアクションのユーザーのみ
	// 1ボタンの場合（ピッカーなし）: リストあり→デフォルト、リストなし→全ユーザー
	const type = props.hasPickerButton
		? instance.defaultReaction
		: props.isReactionListVisible
		? instance.defaultReaction
		: null; // 全ユーザー

	const reactions = await os.apiGet("notes/reactions", {
		noteId: props.note.id,
		...(type ? { type } : {}),
		limit: 11,
		_cacheKey_: props.count,
	});

	const users = reactions.map((x) => x.user);

	if (users.length < 1) return;

	os.popup(
		XDetails,
		{
			showing,
			users,
			count: props.count,
			targetElement: buttonRef.value,
		},
		{},
		"closed"
	);
});
</script>

<style lang="scss" module>
.root {
	display: inline-block;
	height: 2rem;
	margin: 0.125rem;
	padding: 0 0.375rem;
}

.yellow {
	color: var(--warn);
}

.red {
	color: var(--error);
}

.count {
	display: inline;
	margin: 0 0 0 0.5rem;
	opacity: 0.7;
}
</style>
