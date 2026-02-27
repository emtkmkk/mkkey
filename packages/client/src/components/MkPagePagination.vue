<template>
	<transition
		:enter-active-class="
			$store.state.animation ? $style.transition_fade_enterActive : ''
		"
		:leave-active-class="
			$store.state.animation ? $style.transition_fade_leaveActive : ''
		"
		:enter-from-class="
			$store.state.animation ? $style.transition_fade_enterFrom : ''
		"
		:leave-to-class="
			$store.state.animation ? $style.transition_fade_leaveTo : ''
		"
		mode="out-in"
	>
		<MkLoading v-if="fetching" />

		<MkError v-else-if="error" @retry="load()" />

		<div v-else-if="empty" key="_empty_" class="empty">
			<slot name="empty">
				<div v-if="!silenceNothing" class="_fullinfo">
					<img
						src="/static-assets/badges/info.png"
						class="_ghost"
						alt=""
					/>
					<div>{{ i18n.ts.nothing }}</div>
				</div>
			</slot>
		</div>

		<div v-else class="_root">
			<slot :items="items" :total="total"></slot>

			<div v-if="totalPages > 1" class="nav _gap">
				<MkButton
					class="nav-button"
					:disabled="currentPage <= 1"
					@click="goTo(currentPage - 1)"
				>
					{{ i18n.ts._pagePagination?.prev ?? "前へ" }}
				</MkButton>
				<span class="nav-info">
					{{ i18n.ts._pagePagination?.page ?? "ページ" }}
					<input
						v-model.number="pageInput"
						type="number"
						min="1"
						:max="totalPages"
						class="page-input"
						@keydown.enter="goTo(pageInput)"
					/>
					/ {{ totalPages }}
				</span>
				<MkButton
					class="nav-button"
					:disabled="currentPage >= totalPages"
					@click="goTo(currentPage + 1)"
				>
					{{ i18n.ts.next }}
				</MkButton>
			</div>
		</div>
	</transition>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ページ番号ベースのページング用コンポーネント（蓄積型ではない）。
 * fetchPage で1ページ分のみ取得し、前へ/次へ/ページ番号入力で切り替える。
 * { items, total } を返す任意の API と組み合わせて再利用可能。
 *
 * @remarks
 * - 責務: 1ページ分の取得、ナビ表示、ローディング/空/エラー表示。
 * - MkPagination とは別物（蓄積型 load more は使わない）。
 *
 * @public
 */
import { ref, computed, watch } from "vue";
import MkButton from "@/components/MkButton.vue";
import { i18n } from "@/i18n";

export type FetchPageResult<T> = {
	items: T[];
	total: number;
};

export type FetchPageFn<T> = (params: {
	page: number;
	limit: number;
}) => Promise<FetchPageResult<T>>;

const props = withDefaults(
	defineProps<{
		/** 1ページ分を取得する関数。offset は (page-1)*limit で呼び出し側が計算して渡す想定。 */
		fetchPage: FetchPageFn<unknown>;
		/** 1ページあたりの件数 */
		limit: number;
		/** 初期ページ（1始まり）。省略時は 1 */
		initialPage?: number;
		silenceNothing?: boolean;
	}>(),
	{
		initialPage: 1,
		silenceNothing: false,
	},
);

const emit = defineEmits<{
	(ev: "update:page", page: number): void;
}>();

const items = ref<unknown[]>([]);
const total = ref(0);
const fetching = ref(true);
const error = ref(false);
const currentPage = ref(props.initialPage);
const pageInput = ref(props.initialPage);

const totalPages = computed(() =>
	props.limit > 0 ? Math.max(1, Math.ceil(total.value / props.limit)) : 1,
);
const empty = computed(() => !fetching.value && items.value.length === 0);

async function load() {
	fetching.value = true;
	error.value = false;
	try {
		const res = await props.fetchPage({
			page: currentPage.value,
			limit: props.limit,
		});
		items.value = res.items ?? [];
		total.value = res.total ?? 0;
		pageInput.value = currentPage.value;
	} catch (e) {
		error.value = true;
		items.value = [];
		total.value = 0;
	} finally {
		fetching.value = false;
	}
}

function goTo(page: number) {
	const p = Math.max(1, Math.min(Math.floor(Number(page) || 1), totalPages.value));
	currentPage.value = p;
	pageInput.value = p;
	emit("update:page", p);
	load();
}

watch(
	() => props.initialPage,
	(newPage) => {
		const p = Math.max(1, Math.floor(Number(newPage) || 1));
		if (p !== currentPage.value) {
			currentPage.value = p;
			pageInput.value = p;
			load();
		}
	},
);

watch(
	() => props.limit,
	() => {
		currentPage.value = 1;
		pageInput.value = 1;
		emit("update:page", 1);
		load();
	},
);

load();

defineExpose({
	items,
	total,
	currentPage: currentPage,
	totalPages,
	reload: load,
	goTo,
});
</script>

<style lang="scss" scoped>
.nav {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-top: 1rem;

	.nav-info {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.page-input {
		width: 3rem;
		padding: 0.25rem 0.5rem;
		font: inherit;
		text-align: center;
		border: 1px solid var(--inputBorder);
		border-radius: 4px;
		background: var(--inputBg);
		color: var(--fg);
	}
}
</style>

<style lang="scss" module>
.transition_fade_enterActive,
.transition_fade_leaveActive {
	transition: opacity 0.125s ease;
}
.transition_fade_enterFrom,
.transition_fade_leaveTo {
	opacity: 0;
}
</style>
