<template>
	<div>
		<MkStickyContainer>
			<template #header
				><MkPageHeader
					v-model:tab="tab"
					:actions="headerActions"
					:tabs="headerTabs"
					:display-back-button="true"
			/></template>
			<MkSpacer :content-max="900">
				<div class="ogwlenmc">
					<div v-if="tab === 'local'" class="local">
						<div class="inputs">
							<MkInput
								v-model="query"
								:debounce="true"
								type="search"
								@update:modelValue="onLocalFilterChange"
							>
								<template #prefix
									><i
										class="ph-magnifying-glass ph-bold ph-lg"
									></i
								></template>
								<template #label>{{ i18n.ts.search }}</template>
							</MkInput>
							<MkSelect
								v-model="sort"
								@update:modelValue="onLocalFilterChange"
							>
								<template #label>{{ i18n.ts.sort }}</template>
								<option value="-id">ID ({{ i18n.ts.descendingOrder }})</option>
								<option value="+id">ID ({{ i18n.ts.ascendingOrder }})</option>
								<option value="+name">{{ i18n.ts.name }} ({{ i18n.ts.ascendingOrder }})</option>
								<option value="-name">{{ i18n.ts.name }} ({{ i18n.ts.descendingOrder }})</option>
								<option value="-updatedAt">{{ i18n.ts.lastUsed }} ({{ i18n.ts.descendingOrder }})</option>
								<option value="+updatedAt">{{ i18n.ts.lastUsed }} ({{ i18n.ts.ascendingOrder }})</option>
								<option value="-createdAt">{{ i18n.ts.registeredDate }} ({{ i18n.ts.descendingOrder }})</option>
								<option value="+createdAt">{{ i18n.ts.registeredDate }} ({{ i18n.ts.ascendingOrder }})</option>
							</MkSelect>
							<MkSelect v-model="limit" @update:modelValue="onLocalFilterChange">
								<template #label>{{ i18n.ts._pagePagination?.perPage ?? "表示件数" }}</template>
								<option :value="10">10</option>
								<option :value="25">25</option>
								<option :value="50">50</option>
								<option :value="100">100</option>
							</MkSelect>
						</div>
						<div class="filter-row">
							<MkSwitch v-model="noTag" @update:modelValue="onLocalFilterChange">
								<template #label>{{ i18n.ts._adminEmoji?.noTagOnly ?? "未タグのみ" }}</template>
							</MkSwitch>
							<MkSwitch v-model="noLicense" @update:modelValue="onLocalFilterChange">
								<template #label>{{ i18n.ts._adminEmoji?.noLicenseOnly ?? "未ライセンスのみ" }}</template>
							</MkSwitch>
							<MkSwitch v-model="noCategory" @update:modelValue="onLocalFilterChange">
								<template #label>{{ i18n.ts._adminEmoji?.noCategoryOnly ?? "未カテゴリのみ" }}</template>
							</MkSwitch>
						</div>
						<MkSwitch v-model="selectMode" style="margin: 0.5rem 0">
							<template #label>{{ i18n.ts._adminEmoji?.selectMode ?? "Select mode" }}</template>
						</MkSwitch>
						<div
							v-if="selectMode"
							style="
								display: flex;
								gap: var(--margin);
								flex-wrap: wrap;
							"
						>
							<MkButton inline @click="selectAllOnPage">{{ i18n.ts._adminEmoji?.selectAll ?? "Select all" }}</MkButton>
							<MkButton inline @click="unSelectAll">{{ i18n.ts._adminEmoji?.unSelectAll ?? "UnSelect all" }}</MkButton>
							<MkButton inline @click="setCategoryBulk">{{ i18n.ts._adminEmoji?.setCategory ?? "Set category" }}</MkButton>
							<MkButton inline @click="addTagBulk">{{ i18n.ts._adminEmoji?.addTag ?? "Add tag" }}</MkButton>
							<MkButton inline @click="removeTagBulk">{{ i18n.ts._adminEmoji?.removeTag ?? "Remove tag" }}</MkButton>
							<MkButton inline @click="setTagBulk">{{ i18n.ts._adminEmoji?.setTag ?? "Set tag" }}</MkButton>
							<MkButton inline @click="openSetLicenseBulk">{{ i18n.ts._adminEmoji?.setLicense ?? "Set license" }}</MkButton>
							<MkButton inline danger @click="delBulk">{{ i18n.ts.delete }}</MkButton>
						</div>
						<div v-if="selectMode || selectedCount > 0">
							{{ i18n.ts._adminEmoji?.selected ?? "Select" }} : {{ selectedCount }}
						</div>
						<MkPagePagination
							ref="emojisPaginationRef"
							:fetch-page="fetchLocalPage"
							:limit="limit"
							:initial-page="page"
							:silence-nothing="false"
							@update:page="onPageChange"
						>
							<template #empty>
								<span>{{ i18n.ts.noCustomEmojis }}</span>
							</template>
							<template #default="{ items }">
								<div class="ldhfsamy">
									<button
										v-for="emoji in items"
										:key="emoji.id"
										class="emoji _panel _button"
										:class="{
											selected: selectedEmojis.includes(emoji.id),
										}"
										@click="
											selectMode ? toggleSelect(emoji) : edit(emoji)
										"
									>
										<img
											:src="emoji.url"
											class="img"
											:alt="emoji.name"
										/>
										<div class="body">
											<div class="name _monospace">{{ emoji.name }}</div>
											<div
												v-if="
													!emoji.aliases?.length ||
													!emoji.license?.length
												"
												class="info"
											>
												{{
													[
														emoji.aliases?.length ? "" : "NotTag",
														emoji.license?.length ? "" : "NotLicense",
													]
														.filter(Boolean)
														.join(", ")
												}}
											</div>
											<div class="info">{{ emoji.category ?? "" }}</div>
										</div>
									</button>
								</div>
							</template>
						</MkPagePagination>
					</div>

					<div v-else-if="tab === 'remote'" class="remote">
						<div class="inputs">
							<MkInput
								v-model="queryRemote"
								:debounce="true"
								type="search"
								@update:modelValue="onRemoteFilterChange"
							>
								<template #prefix
									><i
										class="ph-magnifying-glass ph-bold ph-lg"
									></i
								></template>
								<template #label>{{ i18n.ts.search }}</template>
							</MkInput>
							<MkInput v-model="host" :debounce="true" @update:modelValue="onRemoteFilterChange">
								<template #label>{{ i18n.ts.host }}</template>
							</MkInput>
							<MkSelect v-model="remoteLimit" @update:modelValue="onRemoteFilterChange">
								<template #label>{{ i18n.ts._pagePagination?.perPage ?? "表示件数" }}</template>
								<option :value="10">10</option>
								<option :value="25">25</option>
								<option :value="50">50</option>
								<option :value="100">100</option>
							</MkSelect>
						</div>
						<MkPagePagination
							ref="remotePaginationRef"
							:fetch-page="fetchRemotePage"
							:limit="remoteLimit"
							:initial-page="remotePage"
							:silence-nothing="false"
							@update:page="onRemotePageChange"
						>
							<template #empty>
								<span>{{ i18n.ts.noCustomEmojis }}</span>
							</template>
							<template #default="{ items }">
								<div class="ldhfsamy">
									<div
										v-for="emoji in items"
										:key="emoji.id"
										class="emoji _panel _button"
										@click="remoteMenu(emoji, $event)"
									>
										<img
											:src="emoji.url"
											class="img"
											:alt="emoji.name"
										/>
										<div class="body">
											<div class="name _monospace">
												{{ emoji.name }}
												{{
													instance.emojis?.some(
														(x) => x.name === emoji.name
													)
														? " ⭐"
														: ""
												}}
											</div>
											<div class="info">
												<i
													v-if="(emoji.copyPermission ?? 'none') === 'conditional'"
													class="ph-bold ph-warning ph-lg"
													style="color: var(--warn)"
												/>
												<i
													v-else-if="(emoji.copyPermission ?? 'none') === 'deny'"
													class="ph-bold ph-prohibit ph-lg"
													style="color: var(--error)"
												/>
												<i
													v-else-if="(emoji.copyPermission ?? 'none') === 'allow' || (emoji.isTextOnly ?? false)"
													class="ph-bold ph-check ph-lg"
													style="color: var(--success)"
												/>
												<i
													v-else-if="emoji.license || emoji.licenseName"
													class="ph-bold ph-info ph-lg"
												/>
												{{ emoji.host }}
											</div>
										</div>
									</div>
								</div>
							</template>
						</MkPagePagination>
					</div>
				</div>
			</MkSpacer>
		</MkStickyContainer>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 管理画面・絵文字一覧ページ。ページングは MkPagePagination（offset/limit、URL 同期）。
 * 一覧のコピー可否表示は emoji.copyPermission を参照。
 *
 * @remarks
 * - ローカル: 検索・並び替え・特殊フィルタ（未タグ/未ライセンス/未カテゴリ）を URL に反映し、リロードで復元。
 * - Select all はそのページの全てを選択。選択は ID 配列で保持するためページをまたいで一括操作可能。
 */
import { computed, defineAsyncComponent, ref, watch } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import MkPagePagination from "@/components/MkPagePagination.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import FormSplit from "@/components/form/split.vue";
import { selectFile, selectFiles } from "@/scripts/select-file";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { instance } from "@/instance";
import { useRouter } from "@/router";
import MkCustomEmojiDetailedDialog from "@/components/MkCustomEmojiDetailedDialog.vue";
import type { FetchPageResult } from "@/components/MkPagePagination.vue";

const ADMIN_EMOJIS_PATH = "/admin/emojis";

const router = useRouter();
const emojisPaginationRef = ref<InstanceType<typeof MkPagePagination>>();
const remotePaginationRef = ref<InstanceType<typeof MkPagePagination>>();

function getQueryFromUrl(): Record<string, string> {
	if (typeof window === "undefined") return {};
	const path =
		(router.getCurrentPath?.() ?? window.location.pathname + window.location.search) || "";
	const full = path.startsWith("/") ? path : `/${path}`;
	const url = new URL(full, window.location.origin);
	return Object.fromEntries(url.searchParams.entries());
}

const initialParams = getQueryFromUrl();

const tab = ref(initialParams.tab === "remote" ? "remote" : "local");
const query = ref(initialParams.q ?? "");
const queryRemote = ref(initialParams.qRemote ?? "");
const host = ref(initialParams.host ?? "");
const page = ref((() => {
	const p = parseInt(initialParams.page ?? "1", 10);
	return !Number.isNaN(p) && p >= 1 ? p : 1;
})());
const limit = ref((() => {
	const l = parseInt(initialParams.limit ?? "50", 10);
	return [10, 25, 50, 100].includes(l) ? l : 50;
})());
const sort = ref(initialParams.sort ?? "-id");
const noTag = ref(initialParams.noTag === "1");
const noLicense = ref(initialParams.noLicense === "1");
const noCategory = ref(initialParams.noCategory === "1");
const remotePage = ref((() => {
	const p = parseInt(initialParams.remotePage ?? "1", 10);
	return !Number.isNaN(p) && p >= 1 ? p : 1;
})());
const remoteLimit = ref((() => {
	const l = parseInt(initialParams.remoteLimit ?? "50", 10);
	return [10, 25, 50, 100].includes(l) ? l : 50;
})());
const selectMode = ref(false);
const selectedEmojis = ref<string[]>([]);
const selectedCount = computed(() => selectedEmojis.value.length);

function buildQuery(): Record<string, string> {
	const q: Record<string, string> = {};
	if (tab.value !== "local") q.tab = tab.value;
	if (tab.value === "local") {
		if (page.value > 1) q.page = String(page.value);
		if (limit.value !== 50) q.limit = String(limit.value);
		if (query.value) q.q = query.value;
		if (sort.value !== "-id") q.sort = sort.value;
		if (noTag.value) q.noTag = "1";
		if (noLicense.value) q.noLicense = "1";
		if (noCategory.value) q.noCategory = "1";
	} else {
		if (remotePage.value > 1) q.remotePage = String(remotePage.value);
		if (remoteLimit.value !== 50) q.remoteLimit = String(remoteLimit.value);
		if (queryRemote.value) q.qRemote = queryRemote.value;
		if (host.value) q.host = host.value;
	}
	return q;
}

function replaceUrl() {
	const q = buildQuery();
	const search = new URLSearchParams(q).toString();
	const path = search ? `${ADMIN_EMOJIS_PATH}?${search}` : ADMIN_EMOJIS_PATH;
	router.replace(path);
}

const fetchLocalPage = async (
	params: { page: number; limit: number },
): Promise<FetchPageResult<unknown>> => {
	const res = await os.api("admin/emoji/list", {
		offset: (params.page - 1) * params.limit,
		limit: params.limit,
		query: query.value && query.value !== "" ? query.value : null,
		sort: sort.value || null,
		noTag: noTag.value,
		noLicense: noLicense.value,
		noCategory: noCategory.value,
	});
	return { items: res.items, total: res.total };
};

function onPageChange(p: number) {
	page.value = p;
	replaceUrl();
}

function onLocalFilterChange() {
	page.value = 1;
	replaceUrl();
	emojisPaginationRef.value?.goTo(1);
	emojisPaginationRef.value?.reload();
}

const fetchRemotePage = async (
	params: { page: number; limit: number },
): Promise<FetchPageResult<unknown>> => {
	const res = await os.api("admin/emoji/list-remote", {
		offset: (params.page - 1) * params.limit,
		limit: params.limit,
		query: queryRemote.value && queryRemote.value !== "" ? queryRemote.value : null,
		host: host.value && host.value !== "" ? host.value : null,
	});
	return { items: res.items, total: res.total };
};

function onRemotePageChange(p: number) {
	remotePage.value = p;
	replaceUrl();
}

function onRemoteFilterChange() {
	remotePage.value = 1;
	replaceUrl();
	remotePaginationRef.value?.goTo(1);
	remotePaginationRef.value?.reload();
}

function selectAllOnPage() {
	const comp = emojisPaginationRef.value;
	if (!comp?.items?.length) return;
	const ids = (comp.items as { id: string }[]).map((item) => item.id);
	const set = new Set(selectedEmojis.value);
	ids.forEach((id) => set.add(id));
	selectedEmojis.value = [...set];
}

function unSelectAll() {
	selectedEmojis.value = [];
}

function toggleSelect(emoji: { id: string }) {
	if (selectedEmojis.value.includes(emoji.id)) {
		selectedEmojis.value = selectedEmojis.value.filter((x) => x !== emoji.id);
	} else {
		selectedEmojis.value.push(emoji.id);
	}
}

const add = async (ev: MouseEvent) => {
	const files = await selectFiles(
		ev.currentTarget ?? (ev.target as HTMLElement),
		null,
		false,
		true,
		"emoji",
	);
	const promise = Promise.all(
		files.map((file) => os.api("admin/emoji/add", { fileId: file.id })),
	);
	promise.then(() => {
		emojisPaginationRef.value?.reload();
	});
	os.promiseDialog(promise);
};

const edit = (emoji: { id: string; [k: string]: unknown }) => {
	os.popup(
		defineAsyncComponent(() => import("./emoji-edit-dialog.vue")),
		{ emoji },
		{
			done: (result: { updated?: unknown; deleted?: unknown }) => {
				if (result.updated || result.deleted) {
					emojisPaginationRef.value?.reload();
				}
			},
		},
		"closed",
	);
};

const im = (emoji: { id: string }) => {
	os.apiWithDialog("admin/emoji/copy", { emojiId: emoji.id });
};

const remoteMenu = async (emoji: { name: string; host?: string }, ev: MouseEvent) => {
	os.popupMenu(
		[
			{ type: "label", text: `:${emoji.name}:` },
			{
				text: i18n.ts.import,
				icon: "ph-plus ph-bold ph-lg",
				action: () => im(emoji as { id: string }),
			},
			{
				text: i18n.ts.info,
				icon: "ph-info ph-bold ph-lg",
				action: () => {
					os.apiGet("emoji", {
						name: emoji.name,
						...(emoji.host ? { host: emoji.host } : {}),
					}).then((res) => {
						os.popup(
							MkCustomEmojiDetailedDialog,
							{ emoji: res },
							{ anchor: ev.target },
							"closed",
						);
					});
				},
			},
		],
		ev.currentTarget ?? (ev.target as HTMLElement),
	);
};

const menu = (ev: MouseEvent) => {
	os.popupMenu(
		[
			{
				icon: "ph-download-simple ph-bold ph-lg",
				text: i18n.ts.export,
				action: () => {
					os.api("export-custom-emojis", {})
						.then(() => os.alert({ type: "info", text: i18n.ts.exportRequested }))
						.catch((err) => os.alert({ type: "error", text: err.message }));
				},
			},
			{
				icon: "ph-upload-simple ph-bold ph-lg",
				text: i18n.ts.import,
				action: async () => {
					const file = await selectFile(
						ev.currentTarget ?? (ev.target as HTMLElement),
						null,
						undefined,
						undefined,
						"emoji",
					);
					os.api("admin/emoji/import-zip", { fileId: file.id })
						.then(() => {
							os.alert({ type: "info", text: i18n.ts.importRequested });
							emojisPaginationRef.value?.reload();
						})
						.catch((err) => os.alert({ type: "error", text: err.message }));
				},
			},
		],
		ev.currentTarget ?? (ev.target as HTMLElement),
	);
};

const setCategoryBulk = async () => {
	const { canceled, result } = await os.inputText({ title: "Category" });
	if (canceled) return;
	await os.apiWithDialog("admin/emoji/set-category-bulk", {
		ids: selectedEmojis.value,
		category: result,
	});
	emojisPaginationRef.value?.reload();
};

const addTagBulk = async () => {
	const { canceled, result } = await os.inputText({ title: "Tag" });
	if (canceled) return;
	await os.apiWithDialog("admin/emoji/add-aliases-bulk", {
		ids: selectedEmojis.value,
		aliases: result.split(" "),
	});
	emojisPaginationRef.value?.reload();
};

const removeTagBulk = async () => {
	const { canceled, result } = await os.inputText({ title: "Tag" });
	if (canceled) return;
	await os.apiWithDialog("admin/emoji/remove-aliases-bulk", {
		ids: selectedEmojis.value,
		aliases: result.split(" "),
	});
	emojisPaginationRef.value?.reload();
};

const setTagBulk = async () => {
	const { canceled, result } = await os.inputText({ title: "Tag" });
	if (canceled) return;
	await os.apiWithDialog("admin/emoji/set-aliases-bulk", {
		ids: selectedEmojis.value,
		aliases: result.split(" "),
	});
	emojisPaginationRef.value?.reload();
};

function openSetLicenseBulk() {
	if (selectedEmojis.value.length === 0) {
		os.alert({ type: "warning", text: i18n.ts._adminEmoji?.selectFirst ?? "絵文字を選択してください。" });
		return;
	}
	os.popup(
		import("./emoji-set-license-bulk-dialog.vue").then((m) => m.default),
		{ emojiIds: selectedEmojis.value },
		{
			done: () => {
				emojisPaginationRef.value?.reload();
			},
		},
		"closed",
	);
}

const delBulk = async () => {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts.deleteConfirm,
	});
	if (canceled) return;
	await os.apiWithDialog("admin/emoji/delete-bulk", {
		ids: selectedEmojis.value,
	});
	emojisPaginationRef.value?.reload();
};

const headerActions = computed(() => [
	{
		asFullButton: true,
		icon: "ph-plus ph-bold ph-lg",
		text: i18n.ts.addEmoji,
		handler: add,
	},
	{
		icon: "ph-dots-three-outline ph-bold ph-lg",
		handler: menu,
	},
]);

const headerTabs = computed(() => [
	{ key: "local", icon: "ph-hand-fist ph-bold ph-lg", title: i18n.ts.local },
	{ key: "remote", icon: "ph-planet ph-bold ph-lg", title: i18n.ts.remote },
]);

watch(tab, () => replaceUrl());

definePageMetadata(
	computed(() => ({
		title: i18n.ts.customEmojis,
		icon: "ph-smiley ph-bold ph-lg",
	})),
);
</script>

<style lang="scss" scoped>
.ogwlenmc {
	> .local {
		.inputs,
		.filter-row {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem 1rem;
			align-items: flex-end;
			margin-bottom: 0.5rem;
		}
		.filter-row {
			align-items: center;
		}
		.empty {
			margin: var(--margin);
		}
		.ldhfsamy {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(11.875rem, 1fr));
			grid-gap: 0.75rem;
			margin: var(--margin) 0;

			> .emoji {
				display: flex;
				align-items: center;
				padding: 0.6875rem;
				text-align: left;
				border: solid 0.0625rem var(--panel);

				&:hover {
					border-color: var(--inputBorderHover);
				}

				&.selected {
					border-color: var(--accent);
				}

				> .img {
					max-width: 2.5rem;
					height: 1.5rem;
				}

				> .body {
					padding: 0 0 0 0.5rem;
					white-space: nowrap;
					overflow: hidden;

					> .name {
						text-overflow: ellipsis;
						overflow: hidden;
					}

					> .info {
						opacity: 0.5;
						text-overflow: ellipsis;
						overflow: hidden;
					}
				}
			}
		}
	}

	> .remote {
		.inputs {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem 1rem;
			align-items: flex-end;
			margin-bottom: 0.5rem;
		}
		.empty {
			margin: var(--margin);
		}
		.ldhfsamy {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(11.875rem, 1fr));
			grid-gap: 0.75rem;
			margin: var(--margin) 0;

			> .emoji {
				display: flex;
				align-items: center;
				padding: 0.75rem;
				text-align: left;

				&:hover {
					color: var(--accent);
				}

				> .img {
					max-width: 2.5rem;
					height: 1.5rem;
				}

				> .body {
					padding: 0 0 0 0.5rem;
					white-space: nowrap;
					overflow: hidden;

					> .name {
						text-overflow: ellipsis;
						overflow: hidden;
					}

					> .info {
						opacity: 0.5;
						font-size: 90%;
						text-overflow: ellipsis;
						overflow: hidden;
					}
				}
			}
		}
	}
}
</style>
