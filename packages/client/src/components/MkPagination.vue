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

		<MkError v-else-if="error" @retry="init()" />

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
						!moreFetchError
							? !moreFetchError && !error && !moreFetching
								? fetchMore
								: null
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
const offset = ref(0);
const fetching = ref(true);
const moreFetching = ref(false);
const more = ref(false);
let backed = $ref(false); // 遡り中か否か
let scrollRemove = $ref<(() => void) | null>(null);
const isBackTop = ref(false);
const empty = computed(() => items.value.length === 0);
const error = ref(false);
const moreFetchError = ref(false);
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

watch(
	[() => props.pagination.reversed, $$(scrollableElement)],
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
				threshold: 0.01,
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

watch([$$(backed), $$(contentEl)], () => {
	if (!backed) {
		if (!unref(contentEl)) return;

		scrollRemove = (
			props.pagination.reversed ? onScrollBottom : onScrollTop
		)(unref(contentEl), executeQueue, TOLERANCE);
	} else {
		if (scrollRemove) scrollRemove();
		scrollRemove = null;
	}
});

if (props.pagination.params && isRef(props.pagination.params)) {
	watch(props.pagination.params, init, { deep: true });
}

watch(
	queue,
	(a, b) => {
		if (a.length === 0 && b.length === 0) return;
		emit("queue", queue.value.length, isTop() && !isPausingUpdate);
	},
	{ deep: true }
);

async function init(): Promise<void> {
	queue.value = [];
	fetching.value = true;
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
				error.value = false;
				fetching.value = false;
			},
			(err) => {
				error.value = true;
				errorMsg.value = err;
				fetching.value = false;
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
				error.value = true;
				errorMsg.value = err;
				fetching.value = false;
			}
		);
};

const fetchMore = async (): Promise<void> => {
	if (fetching.value || moreFetching.value || items.value.length === 0)
		return;
	lastFetchDate.value = Date.now();
	moreFetchError.value = false;
	moreFetching.value = true;
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
	await os
		.api(endpoint, {
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
		})
		.then(
			(res) => {
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
					more.value = res?.length === resFiltered?.length;
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
				moreFetching.value = false;
				ctAutoReload.value = true;
				if (timerId) clearTimeout(timerId);
				timerId = setTimeout(() => {
					ctAutoReload.value = false;
				}, 1500);
			},
			(err) => {
				moreFetchError.value = true;
				errorMsg.value = err;
				moreFetching.value = false;
			}
		);
};

const fetchMoreAhead = async (): Promise<void> => {
	if (
		!more.value ||
		fetching.value ||
		moreFetching.value ||
		items.value.length === 0
	)
		return;
	lastFetchDate.value = Date.now();
	moreFetchError.value = false;
	moreFetching.value = true;
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
		})
		.then(
			(res) => {
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
				moreFetching.value = false;
				ctAutoReload.value = true;
				if (timerId) clearTimeout(timerId);
				timerId = setTimeout(() => {
					ctAutoReload.value = false;
				}, 1500);
			},
			(err) => {
				moreFetchError.value = true;
				errorMsg.value = err;
				moreFetching.value = false;
			}
		);
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

onMounted(() => {
	inited.then(() => {
		if (props.pagination.reversed) {
			nextTick(() => {
				setTimeout(toBottom, 800);

				// scrollToBottomでmoreFetchingボタンが画面外まで出るまで
				// more = trueを遅らせる
				setTimeout(() => {
					moreFetching.value = false;
				}, 2000);
			});
		}
	});
});

onBeforeUnmount(() => {
	if (timerForSetPause) {
		clearTimeout(timerForSetPause);
		timerForSetPause = null;
	}
	scrollObserver.disconnect();
});

defineExpose({
	items,
	queue,
	backed,
	active: isTop() && !isPausingUpdate,
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
