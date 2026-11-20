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
		<MkLoading v-if="phase === 'loading'" />

		<MkError v-else-if="phase === 'error'" @retry="init()" />

		<div v-else-if="empty" key="_empty_" class="empty">
			<slot name="empty">
				<div v-if="!silenceNothing" class="_fullinfo">
					<img
						src="/static-assets/badges/info.png"
						class="_ghost"
						alt="Error"
					/>
					<div>{{ i18n.ts.nothing }}</div>
				</div>
			</slot>
		</div>

		<div v-else ref="rootEl">
			<div
				v-show="pagination.reversed && moreFetchError"
				key="_errorrev_"
				class="cxiknjgy _gap"
			>
				<div key="_errordiv_" class="_miniinfo">
					<img
						src="/static-assets/badges/error.png"
						:title="errorMsg"
						v-tooltip="errorMsg"
						alt="notMore"
					/>
				</div>
			</div>
			<div
				v-show="pagination.reversed && more"
				key="_more_"
				class="cxiknjgy _gap"
			>
				<MkButton
					v-if="!moreFetching"
					class="button"
					:disabled="moreFetching"
					:style="{ cursor: moreFetching ? 'wait' : 'pointer' }"
					primary
					@click="fetchMoreAhead"
				>
					{{ i18n.ts.loadMore }}
				</MkButton>
				<MkLoading v-else class="loading" />
			</div>
			<div
				v-show="pagination.reversed && !moreFetchError && !more"
				key="_notmore_"
				class="cxiknjgy _gap"
			>
				<div key="_icondiv_" class="_miniinfo">
					<img
						:src="$instance.iconUrl"
						class="_ghost"
						alt="notMore"
					/>
				</div>
			</div>
			<slot :items="items"></slot>
			<div
				v-show="!pagination.reversed && more"
				key="_more_"
				class="cxiknjgy _gap"
			>
				<MkButton
					v-if="!moreFetching"
					v-appear="
						$store.state.enableInfiniteScroll &&
						!disableAutoLoad &&
						phase === 'ready'
							? fetchMore
							: null
					"
					class="button"
					:disabled="moreFetching"
					:style="{ cursor: moreFetching ? 'wait' : 'pointer' }"
					primary
					@click="fetchMore"
				>
					{{ i18n.ts.loadMore }}
				</MkButton>
				<MkLoading v-else class="loading" />
			</div>
			<div
				v-show="!pagination.reversed && !moreFetchError && !more"
				key="_notmore_"
				class="cxiknjgy _gap"
			>
				<div key="_icondiv_" class="_miniinfo">
					<img
						:src="$instance.iconUrl"
						alt="notMore"
						@click="fetchMore"
					/>
				</div>
			</div>
			<div
				v-show="!pagination.reversed && moreFetchError"
				key="_errorf_"
				class="cxiknjgy _gap"
			>
				<div key="_errordiv_" class="_miniinfo">
					<img
						src="/static-assets/badges/error.png"
						:title="errorMsg"
						v-tooltip="errorMsg"
						alt="notMore"
					/>
				</div>
			</div>
		</div>
	</transition>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * API の結果をページ送りしながら一覧表示する部品。タイムライン・通知・各種一覧の土台。
 *
 * @remarks
 * - 読み込みの状態は {@link LoadPhase} の 1 つだけで持つ（以前は fetching / error / moreFetching / moreFetchError の 4 つ）。
 *   テンプレートの表示条件と、各読み込み関数の「始めてよいか」の判定は、この 1 つを見る。
 * - 応答が届いたとき、その間に {@link init} がやり直されていたら（{@link loadGeneration} が変わっていたら）結果を捨てる。
 *   絞り込みを素早く切り替えたときに、古い条件の結果で上書き・追記しないため。
 * - スクロール位置の状態（backed / isBackTop / isPausingUpdate）は読み込みとは独立しているので別に持つ。
 * - TODO: ctAutoReload は書き込むだけで、どこからも読まれていない。使い道が無ければ消す。
 *
 * @internal
 */
import {
	computed,
	ComputedRef,
	isRef,
	markRaw,
	nextTick,
	onActivated,
	onBeforeUnmount,
	onDeactivated,
	onMounted,
	Ref,
	ref,
	unref,
	watch,
} from "vue";
import * as misskey from "calckey-js";
import * as os from "@/os";
import {
	onScrollTop,
	isTopVisible,
	getScrollPosition,
	getBodyScrollHeight,
	getScrollContainer,
	onScrollBottom,
	scrollToBottom,
	scroll,
	isBottomVisible,
} from "@/scripts/scroll";
import { useDocumentVisibility } from "@/scripts/use-document-visibility";
import MkButton from "@/components/MkButton.vue";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";

export type Paging<
	E extends keyof misskey.Endpoints = keyof misskey.Endpoints
> = {
	endpoint: E;
	limit: number;
	params?:
		| misskey.Endpoints[E]["req"]
		| ComputedRef<misskey.Endpoints[E]["req"]>;

	/**
	 * 検索APIのような、ページング不可なエンドポイントを利用する場合
	 * (そのようなAPIをこの関数で使うのは若干矛盾してるけど)
	 */
	noPaging?: boolean;

	/**
	 * items 配列の中身を逆順にする(新しい方が最後)
	 */
	reversed?: boolean;

	offsetMode?: boolean;
};

const SECOND_FETCH_LIMIT = 30;
const TOLERANCE = 16;

const props = withDefaults(
	defineProps<{
		pagination: Paging;
		disableAutoLoad?: boolean;
		displayLimit?: number;
		silenceNothing?: boolean;
	}>(),
	{
		displayLimit: 30,
	}
);

const emit = defineEmits<{
	(ev: "queue", count: number, active?: boolean): void;
}>();

type Item = { id: string; [another: string]: unknown };

const rootEl = $ref<HTMLElement>();
const items = ref<Item[]>([]);
const queue = ref<Item[]>([]);
const DUP_CHECK_RANGE = 50;

function hasRecent(id: Item["id"]): boolean {
       for (const item of queue.value) {
               if (item.id === id) return true;
       }
       for (let i = 0; i < Math.min(items.value.length, DUP_CHECK_RANGE); i++) {
               if (items.value[i].id === id) return true;
       }
       return false;
}
const offset = ref(0);

// #region 読み込みの状態

/**
 * 読み込みの状態。
 *
 * @remarks
 * ```text
 *  init() ─▶ loading ──成功──▶ ready ──fetchMore──▶ loadingMore ──成功──▶ ready
 *               │                ▲                       │
 *               └──失敗──▶ error  └────再試行──── moreError ◀──失敗──┘
 * ```
 * - どの状態からでも init()（再読み込み・絞り込みの変更・エラー画面の再試行）で loading に戻る。
 * - refresh() が失敗したときも、以前と同じく error（一覧ごとエラー表示）にする。
 * - 「まだ続きがあるか」は状態とは別の {@link more} で持つ（ready でも moreError でもありうるため）。
 *
 * @internal
 */
type LoadPhase = "loading" | "error" | "ready" | "loadingMore" | "moreError";

const phase = ref<LoadPhase>("loading");
/**
 * 何回目の init() かを表す番号。init() のたびに増やす。
 *
 * @remarks
 * 読み込みを始めたときの番号を覚えておき、応答が届いた時点で変わっていたら、その応答は古いので捨てる。
 */
let loadGeneration = 0;

/** 続きの読み込みを始めてよい状態か（失敗した後の再試行も含む） */
const canLoadMore = (): boolean =>
	(phase.value === "ready" || phase.value === "moreError") &&
	items.value.length > 0;

/** テンプレートで使う、続きを読み込み中か */
const moreFetching = computed(() => phase.value === "loadingMore");
/** テンプレートで使う、続きの読み込みに失敗したか */
const moreFetchError = computed(() => phase.value === "moreError");

// #endregion

const more = ref(false);
let backed = $ref(false); // 遡り中か否か
let scrollRemove = $ref<(() => void) | null>(null);
const isBackTop = ref(false);
const empty = computed(() => items.value.length === 0);
const lastFetchDate = ref(0);
const errorMsg = ref("");
const ctAutoReload = ref(false);
let timerId = null;

const contentEl = $computed(() => props.pagination.pageEl ?? rootEl);
const scrollableElement = $computed(() =>
	unref(contentEl) ? getScrollContainer(unref(contentEl)) : document.body
);

const visibility = useDocumentVisibility();
let isPausingUpdate = false;
let timerForSetPause: number | null = null;
const BACKGROUND_PAUSE_WAIT_SEC = 10;

// 先頭が表示されているかどうかを検出
// https://qiita.com/mkataigi/items/0154aefd2223ce23398e
let scrollObserver = $ref<IntersectionObserver>();

const getObserverThreshold = (): number => {
	const root = unref(scrollableElement);
	const rootHeight =
		root && root !== document.body
			? root.clientHeight
			: window.innerHeight;

	return Math.max(
		Math.min(0.02 / (Math.max(rootHeight, 1) / window.innerHeight), 0.01),
		0.001
	);
};

watch(
	[
		() => props.pagination.reversed,
		$$(scrollableElement),
	],
	() => {
		if (scrollObserver) scrollObserver.disconnect();

		scrollObserver = new IntersectionObserver(
			(entries) => {
				backed = entries[0].isIntersecting;
			},
			{
				root: unref(scrollableElement),
				rootMargin: props.pagination.reversed
					? "-100% 0px 100% 0px"
					: "100% 0px -100% 0px",
				threshold: getObserverThreshold(),
			}
		);
	},
	{ immediate: true }
);

watch($$(rootEl), () => {
	scrollObserver?.disconnect();
	nextTick(() => {
		if (unref(rootEl)) scrollObserver?.observe(unref(rootEl));
	});
});

// コンテナーの差し替え時は、前の監視をwatchのクリーンアップで先に解除する。
watch([$$(backed), $$(contentEl)], (_current, _previous, onCleanup) => {
	if (!backed && unref(contentEl)) {
		const remove = (
			props.pagination.reversed ? onScrollBottom : onScrollTop
		)(unref(contentEl), executeQueue, TOLERANCE);
		// 要素がまだ文書に入っていないときは監視を付けず、解除関数も返らない。
		// そのまま onCleanup で呼ぶと「is not a function」になるので、何もしない。
		if (!remove) return;
		scrollRemove = remove;
		onCleanup(() => {
			// onBeforeUnmountで既に解除した場合は二重に呼ばない。
			if (scrollRemove !== remove) return;
			remove();
			scrollRemove = null;
		});
	}
});

if (props.pagination.params && isRef(props.pagination.params)) {
	watch(props.pagination.params, init, { deep: true });
}

watch(
	() => queue.value.length,
	(count) => {
		// 通知するのは件数と追従状態だけ。投稿内部の画像・絵文字まで追跡しない。
		emit("queue", count, isTop() && !isPausingUpdate);
	},
);

/**
 * 一覧を最初から読み込み直す。
 *
 * @remarks
 * どの状態からでも呼べる。呼ぶと {@link loadGeneration} が変わるので、
 * 途中だったほかの読み込み（前の init・fetchMore・fetchMoreAhead）の応答は捨てられる。
 *
 * @returns 読み込みが終わったら（成功・失敗・古くなって捨てた、のどれでも）解決する
 */
async function init(): Promise<void> {
	const generation = ++loadGeneration;
	queue.value = [];
	phase.value = "loading";
	const endpoint = props.pagination.endpoint
		? isRef(props.pagination.endpoint)
			? props.pagination.endpoint.value
			: props.pagination.endpoint
		: "";
	const params = props.pagination.params
		? isRef(props.pagination.params)
			? props.pagination.params.value
			: props.pagination.params
		: {};
	await os
		.api(endpoint, {
			...params,
			limit: props.pagination.noPaging
				? props.pagination.limit || 10
				: (props.pagination.limit || 10) + 1,
		})
		.then(
			(res) => {
				// 待っている間に init がやり直された。新しい方の結果を待つ
				if (generation !== loadGeneration) return;
				for (let i = 0; i < res.length; i++) {
					const item = res[i];
					if (props.pagination.reversed) {
						if (i === res.length - 2) item._shouldInsertAd_ = true;
					} else {
						if (i === 3) item._shouldInsertAd_ = true;
					}
				}
				if (
					!props.pagination.noPaging &&
					res.length >
						(props.pagination.offsetMode ||
						props.pagination.reversed
							? props.pagination.limit || 10
							: 0)
				) {
					if (res.length > (props.pagination.limit || 10)) res.pop();
					items.value = props.pagination.reversed
						? [...res].reverse()
						: res;
					more.value = true;
				} else {
					items.value = props.pagination.reversed
						? [...res].reverse()
						: res;
					more.value = false;
				}
				offset.value = res.length;
				// 前の条件での「続きの読み込み失敗」もここで消える
				phase.value = "ready";
			},
			(err) => {
				if (generation !== loadGeneration) return;
				phase.value = "error";
				errorMsg.value = err?.message ?? String(err);
			}
		);
}

const reload = (): void => {
	items.value = [];
	init();
};

const refresh = async (): void => {
	const endpoint = props.pagination.endpoint
		? isRef(props.pagination.endpoint)
			? props.pagination.endpoint.value
			: props.pagination.endpoint
		: "";
	const params = props.pagination.params
		? isRef(props.pagination.params)
			? props.pagination.params.value
			: props.pagination.params
		: {};
	await os
		.api(endpoint, {
			...params,
			limit: items.value.length + 1,
			offset: 0,
		})
		.then(
			(res) => {
				let ids = items.value.reduce((a, b) => {
					a[b.id] = true;
					return a;
				}, {} as { [id: string]: boolean });

				for (let i = 0; i < res.length; i++) {
					const item = res[i];
					if (!updateItem(item.id, (old) => item)) {
						append(item);
					}
					delete ids[item.id];
				}

				for (const id in ids) {
					removeItem((i) => i.id === id);
				}
			},
			(err) => {
				// 以前と同じく、一覧ごとエラー表示にする（再試行で init から読み直す）
				phase.value = "error";
				errorMsg.value = err?.message ?? String(err);
			}
		);
};

/**
 * 末尾方向の追加取得。
 *
 * @remarks
 * - ready か moreError（再試行）のときだけ始める。始めると loadingMore になる。
 * - 成功ハンドラ内で例外が出ても loadingMore が残らないよう `finally` で状態を戻す。
 * - 失敗時は moreError にし、ボタン再表示で再試行可能にする。
 * - 待っている間に init がやり直されたら、結果を捨てて状態にも触らない。
 */
const fetchMore = async (): Promise<void> => {
	if (!canLoadMore()) return;
	const generation = loadGeneration;
	let outcome: LoadPhase = "moreError";
	lastFetchDate.value = Date.now();
	phase.value = "loadingMore";
	backed = true;
	const endpoint = props.pagination.endpoint
		? isRef(props.pagination.endpoint)
			? props.pagination.endpoint.value
			: props.pagination.endpoint
		: "";
	const params = props.pagination.params
		? isRef(props.pagination.params)
			? props.pagination.params.value
			: props.pagination.params
		: {};
	try {
		const res = await os.api(endpoint, {
			...params,
			limit: SECOND_FETCH_LIMIT + 1,
			...(props.pagination.offsetMode
				? {
						offset: offset.value,
				  }
				: props.pagination.reversed
				? {
						sinceId: items.value[0].id,
				  }
				: {
						untilId: items.value[items.value.length - 1].id,
				  }),
		});
		// 待っている間に init がやり直された。古い条件の結果なので足さない
		if (generation !== loadGeneration) return;
		for (let i = 0; i < res.length; i++) {
			const item = res[i];
			if (props.pagination.reversed) {
				if (i === res.length - 9) item._shouldInsertAd_ = true;
			} else {
				if (i === 10) item._shouldInsertAd_ = true;
			}
		}
		const itemIdArray = items.value?.map((x) => x.id);
		if (
			res.length >
			(props.pagination.offsetMode || props.pagination.reversed
				? SECOND_FETCH_LIMIT
				: 0)
		) {
			if (res.length > SECOND_FETCH_LIMIT) res.pop();
			// 既に取得してる項目に重複項目があれば取り除く
			// TODO : 重いかも
			const resFiltered = res.filter(
				(x) => !itemIdArray.includes(x.id)
			);
			items.value = props.pagination.reversed
				? [...resFiltered].reverse().concat(items.value)
				: items.value.concat(resFiltered);
			// NOTE: 取得件数がしきい値を超えた時点で「まだ続きがある」ことは確定しているため、
			// 既存アイテムとの重複除去の有無に関わらず more は常に true にする
			more.value = true;
		} else {
			const resFiltered = res.filter(
				(x) => !itemIdArray.includes(x.id)
			);
			items.value = props.pagination.reversed
				? [...resFiltered].reverse().concat(items.value)
				: items.value.concat(resFiltered);
			more.value = false;
		}
		offset.value += res.length;
		if (res[0]?.createdAt)
			defaultStore.set("lastBackedDate", {
				...defaultStore.state.lastBackedDate,
				[props.pagination.endpoint]: {
					date: res[0]?.createdAt,
					createdAt: new Date().toISOString(),
				},
			});
		ctAutoReload.value = true;
		if (timerId) clearTimeout(timerId);
		timerId = setTimeout(() => {
			ctAutoReload.value = false;
		}, 1500);
		outcome = "ready";
	} catch (err: any) {
		errorMsg.value = err?.message ?? String(err);
	} finally {
		// 成功ハンドラ内例外・API 失敗いずれでもスピナー解除を保証する
		finishLoadingMore(generation, outcome);
	}
};

/**
 * 続きの読み込みを終え、状態を ready か moreError に戻す。
 *
 * @remarks
 * 待っている間に init がやり直されたとき、または refresh の失敗で error になったときは、
 * そちらの状態を優先して何もしない。
 *
 * @param generation - 読み込みを始めたときの {@link loadGeneration}
 * @param outcome - 成功なら ready、失敗なら moreError
 */
function finishLoadingMore(generation: number, outcome: LoadPhase): void {
	if (generation !== loadGeneration || phase.value !== "loadingMore") return;
	phase.value = outcome;
}

/**
 * 先頭方向（reversed）の追加取得。
 *
 * @remarks
 * 状態の扱いは `fetchMore` と同じ。`finally` で loadingMore を必ず戻す。
 */
const fetchMoreAhead = async (): Promise<void> => {
	if (!more.value || !canLoadMore()) return;
	const generation = loadGeneration;
	let outcome: LoadPhase = "moreError";
	lastFetchDate.value = Date.now();
	phase.value = "loadingMore";
	const endpoint = props.pagination.endpoint
		? isRef(props.pagination.endpoint)
			? props.pagination.endpoint.value
			: props.pagination.endpoint
		: "";
	const params = props.pagination.params
		? isRef(props.pagination.params)
			? props.pagination.params.value
			: props.pagination.params
		: {};
	try {
		const res = await os.api(endpoint, {
			...params,
			limit: SECOND_FETCH_LIMIT + 1,
			...(props.pagination.offsetMode
				? {
						offset: offset.value,
				  }
				: props.pagination.reversed
				? params.sinceId && !params.untilId
					? {
							sinceId: items.value[0].id,
					  }
					: {
							untilId: items.value[0].id,
					  }
				: {
						sinceId: items.value[items.value.length - 1].id,
				  }),
		});
		// 待っている間に init がやり直された。古い条件の結果なので足さない
		if (generation !== loadGeneration) return;
		if (
			res.length >
			(props.pagination.offsetMode || props.pagination.reversed
				? SECOND_FETCH_LIMIT
				: 0)
		) {
			if (res.length > SECOND_FETCH_LIMIT) res.pop();
			items.value = props.pagination.reversed
				? [...res].reverse().concat(items.value)
				: items.value.concat(res);
			more.value = true;
		} else {
			items.value = props.pagination.reversed
				? [...res].reverse().concat(items.value)
				: items.value.concat(res);
			more.value = false;
		}
		offset.value += res.length;
		ctAutoReload.value = true;
		if (timerId) clearTimeout(timerId);
		timerId = setTimeout(() => {
			ctAutoReload.value = false;
		}, 1500);
		outcome = "ready";
	} catch (err: any) {
		errorMsg.value = err?.message ?? String(err);
	} finally {
		finishLoadingMore(generation, outcome);
	}
};

const isTop = (): boolean =>
	isBackTop.value ||
	(props.pagination.reversed ? isBottomVisible : isTopVisible)(
		unref(contentEl),
		TOLERANCE
	);
watch(visibility, () => {
	if (visibility.value === "hidden") {
		timerForSetPause = window.setTimeout(() => {
			isPausingUpdate = true;
			timerForSetPause = null;
		}, BACKGROUND_PAUSE_WAIT_SEC * 1000);
	} else {
		// 'visible'
		if (timerForSetPause) {
			clearTimeout(timerForSetPause);
			timerForSetPause = null;
		} else {
			isPausingUpdate = false;
			if (isTop()) {
				executeQueue();
			}
		}
	}
});

const prepend = (item: Item): void => {
       if (hasRecent(item.id)) return;

       // 初回表示時はunshiftだけでOK
       if (!rootEl) {
               items.value.unshift(item);
               return;
       }

	if (isTop() && !isPausingUpdate) unshiftItems([item]);
	else prependQueue(item);
};

function unshiftItems(newItems: Item[]) {
	const length = newItems.length + items.value.length;
	items.value = [...newItems, ...items.value].slice(0, props.displayLimit);

	if (length >= props.displayLimit) more.value = true;
}

function executeQueue() {
	if (queue.value.length === 0) return;
	unshiftItems(queue.value);
	queue.value = [];
}

function prependQueue(newItem: Item) {
       if (hasRecent(newItem.id)) return;

       queue.value.unshift(newItem);
       if (queue.value.length >= props.displayLimit) {
               queue.value.pop();
       }
}

const append = (item: Item): void => {
	items.value.push(item);
};

const appendItem = (item: Item): void => {
	items.value.push(item);
};

const removeItem = (finder: (item: Item) => boolean): boolean => {
	const i = items.value.findIndex(finder);
	if (i === -1) {
		return false;
	}

	items.value.splice(i, 1);
	return true;
};

const updateItem = (id: Item["id"], replacer: (old: Item) => Item): boolean => {
	const i = items.value.findIndex((item) => item.id === id);
	if (i === -1) {
		return false;
	}

	items.value[i] = replacer(items.value[i]);
	return true;
};

const inited = init();

onActivated(() => {
	isBackTop.value = false;
});

onDeactivated(() => {
	isBackTop.value = props.pagination.reversed
		? window.scrollY >=
		  (rootEl ? rootEl.scrollHeight - window.innerHeight : 0)
		: window.scrollY === 0;
});

function toBottom() {
	scrollToBottom(unref(contentEl));
}

/** reversed 初回表示時の最下部追従用 ResizeObserver */
let bottomResizeObserver: ResizeObserver | null = null;
let bottomResizeStableTimer: ReturnType<typeof setTimeout> | null = null;

function stopReversedBottomTracking(): void {
	bottomResizeObserver?.disconnect();
	bottomResizeObserver = null;
	if (bottomResizeStableTimer != null) {
		clearTimeout(bottomResizeStableTimer);
		bottomResizeStableTimer = null;
	}
}

/** コンテンツ高さの変化に追従して最下部へスクロールする */
function startReversedBottomTracking(): void {
	const el = unref(contentEl);
	if (!el) return;

	const scrollDown = () => scrollToBottom(el);
	scrollDown();

	bottomResizeObserver = new ResizeObserver(() => {
		scrollDown();
		if (bottomResizeStableTimer != null) {
			clearTimeout(bottomResizeStableTimer);
		}
		// 高さが安定したら observer を解除
		bottomResizeStableTimer = setTimeout(() => {
			stopReversedBottomTracking();
		}, 150);
	});
	bottomResizeObserver.observe(el);
}

onMounted(() => {
	inited.then(() => {
		if (props.pagination.reversed) {
			// NOTE: 以前はここで 2 秒後に moreFetching を false にしていた。初回表示の時点では常に false なので何も起きず、
			// ちょうど続きの読み込み中だと二重読み込みを許してしまうだけだったため外した。
			nextTick(() => {
				startReversedBottomTracking();
			});
		}
	});
});

onBeforeUnmount(() => {
	stopReversedBottomTracking();
	if (timerForSetPause) {
		clearTimeout(timerForSetPause);
		timerForSetPause = null;
	}
	if (scrollRemove) {
		scrollRemove();
		scrollRemove = null;
	}
	if (timerId) {
		clearTimeout(timerId);
		timerId = null;
	}
	scrollObserver.disconnect();
});

defineExpose({
	get items() {
		return items.value;
	},
	get queue() {
		return queue.value;
	},
	get backed() {
		return backed;
	},
	get active() {
		return isTop() && !isPausingUpdate;
	},
	reload,
	refresh,
	prepend,
	append,
	removeItem,
	updateItem,
});
</script>

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

<style lang="scss" scoped>
.cxiknjgy {
	> .button {
		margin-left: auto;
		margin-right: auto;
	}
}
</style>
