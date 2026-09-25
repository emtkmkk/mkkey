<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader v-model:tab="tab" :tabs="headerTabs" :actions="headerActions" :display-back-button="true" />
		</template>
		<MkSpacer :content-max="700">
			<div v-if="loading" :class="$style.empty">読み込んでいます…</div>

			<!-- #region 追加申請 -->
			<template v-else-if="tab === 'add'">
				<template v-if="needsAction.length > 0">
					<div :class="$style.groupHead">
						<i class="ph-warning-circle ph-bold"></i> 対応をお願いします
					</div>
					<div :class="$style.list">
						<MkA
							v-for="r in needsAction"
							:key="r.id"
							:to="`/emoji-requests/add/${r.id}`"
							:class="[$style.item, $style.itemAction]"
						>
							<img v-if="r.file" :src="r.file.url" :class="$style.thumb" alt="" />
							<div :class="$style.body">
								<span :class="$style.name">:{{ r.name }}:</span>
								<span :class="$style.date">{{ formatRequestDate(r.updatedAt) }}</span>
							</div>
							<span :class="[$style.badge, $style[statusOf(r.status).tone]]">{{ statusOf(r.status).label }}</span>
						</MkA>
					</div>
				</template>

				<div v-if="others.length === 0 && needsAction.length === 0" :class="$style.empty">
					追加申請はまだありません
				</div>
				<div v-else-if="others.length > 0" :class="$style.list">
					<MkA
						v-for="r in others"
						:key="r.id"
						:to="`/emoji-requests/add/${r.id}`"
						:class="$style.item"
					>
						<img v-if="r.file" :src="r.file.url" :class="$style.thumb" alt="" />
						<div v-else :class="$style.thumb"></div>
						<div :class="$style.body">
							<span :class="$style.name">:{{ r.name }}:</span>
							<span :class="$style.date">{{ formatRequestDate(r.processedAt ?? r.createdAt) }}</span>
						</div>
						<span :class="[$style.badge, $style[statusOf(r.status).tone]]">{{ statusOf(r.status).label }}</span>
					</MkA>
				</div>
				<MkButton v-if="addHasMore" full :class="$style.more" :disabled="loadingMore" @click="fetchAdd(true)">
					もっと見る
				</MkButton>
			</template>
			<!-- #endregion -->

			<!-- #region インポート申請 -->
			<template v-else-if="tab === 'import'">
				<div v-if="importItems.length === 0" :class="$style.empty">
					インポート申請はまだありません
				</div>
				<div v-else :class="$style.list">
					<MkA
						v-for="r in importItems"
						:key="r.id"
						:to="`/emoji-requests/import/${r.id}`"
						:class="$style.item"
					>
						<MkEmoji
							:emoji="r.status === 'approved' ? `:${r.emojiName}:` : `:${r.emojiName}@${r.emojiHost}:`"
							normal
							:class="$style.thumbEmoji"
						/>
						<div :class="$style.body">
							<span :class="$style.name">:{{ r.emojiName }}@{{ r.emojiHost }}:</span>
							<span :class="$style.date">{{ formatRequestDate(r.processedAt ?? r.createdAt) }}</span>
						</div>
						<span :class="[$style.badge, $style[statusOf(r.status).tone]]">{{ statusOf(r.status).label }}</span>
					</MkA>
				</div>
			</template>
			<!-- #endregion -->
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字申請ページ（`/emoji-requests`）。自分の申請を、種類（追加・インポート）で切り替えて一覧する。
 *
 * @remarks
 * - 追加申請とインポート申請を 1 ページにまとめる（G1）。変更申請は第 1 段階 B でタブを足す
 * - 古い URL（`/my/emoji-import-requests`）から来たときは、インポート申請のタブに置き換える（G2）
 * - 修正のお願いが届いている申請は、「対応をお願いします」として一番上に分けて出す
 * - 行を押すと、その申請の詳細ページ（`/emoji-requests/{種類}/{id}`）を開く
 * TODO: 第 1 段階 B で「変更申請」のタブと［変更を申請］ボタンを足す
 *
 * @internal
 */
import { computed, onActivated, onMounted, ref } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkEmoji from "@/components/global/MkEmoji.vue";
import * as os from "@/os";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import {
	EMOJI_REQUEST_STATUS,
	formatRequestDate,
	type PackedEmojiAddRequest,
	type PackedEmojiImportRequest,
} from "@/scripts/emoji-request";

const props = defineProps<{
	/** 最初に開く種類（"add" / "import"） */
	kind?: string;
}>();

const router = useRouter();

/** 追加申請を 1 回に取る件数 */
const PAGE_SIZE = 30;

const tab = ref<"add" | "import">(props.kind === "import" ? "import" : "add");
/** ヘッダー右上のボタン（［＋］で絵文字を申請） */
const headerActions = computed(() => [
	{
		icon: "ph-plus ph-bold ph-lg",
		text: "絵文字を申請",
		handler: () => router.push("/emoji-requests/new"),
	},
]);

const headerTabs = computed(() => [
	{ key: "add", title: "追加申請", icon: "ph-plus-circle ph-bold ph-lg" },
	{ key: "import", title: "インポート申請", icon: "ph-download-simple ph-bold ph-lg" },
]);

const loading = ref(true);
const loadingMore = ref(false);
const addItems = ref<PackedEmojiAddRequest[]>([]);
const addHasMore = ref(false);
const importItems = ref<PackedEmojiImportRequest[]>([]);

/** 修正のお願いが届いている申請（一番上に分けて出す） */
const needsAction = computed(() => addItems.value.filter((r) => r.status === "changesRequested"));
const others = computed(() => addItems.value.filter((r) => r.status !== "changesRequested"));

/**
 * 状態の表示名と色を引く。
 *
 * @param status - 申請の状態
 * @returns 表示名と札の色
 */
function statusOf(status: string) {
	return EMOJI_REQUEST_STATUS[status] ?? { label: status, tone: "dim" as const };
}

/**
 * 追加申請を取る。
 *
 * @param more - true なら続きを取って後ろに足す
 */
async function fetchAdd(more = false): Promise<void> {
	loadingMore.value = more;
	try {
		const res = await os.api("emoji-add-request/my-list", {
			limit: PAGE_SIZE,
			offset: more ? addItems.value.length : 0,
		});
		const items = res.items as PackedEmojiAddRequest[];
		addItems.value = more ? [...addItems.value, ...items] : items;
		addHasMore.value = items.length === PAGE_SIZE;
	} finally {
		loadingMore.value = false;
	}
}

/** インポート申請を取る（状態ごとに分かれて返ってくるので、新しい順に 1 列にする） */
async function fetchImport(): Promise<void> {
	const res = await os.api("emoji-import-request/my-list", {});
	importItems.value = [...(res.pending ?? []), ...(res.approved ?? []), ...(res.rejected ?? [])].sort(
		(a: PackedEmojiImportRequest, b: PackedEmojiImportRequest) =>
			(b.processedAt ?? b.createdAt).localeCompare(a.processedAt ?? a.createdAt),
	);
}

// NOTE: ページはルーターに保持（KeepAlive）されるので、一度開いたページに戻ると onMounted は動かない。
// 申請や審査で内容が変わっているかもしれないので、2 回目以降に表示されたときは読み直す
let activatedOnce = false;
onActivated(() => {
	if (activatedOnce) void Promise.all([fetchAdd(), fetchImport()]);
	activatedOnce = true;
});

onMounted(async () => {
	// 古い URL から来たときは、新しい URL に置き換える（置き換え先でこのページが開き直される）
	if (router.getCurrentPath().startsWith("/my/emoji-import-requests")) {
		router.replace("/emoji-requests?kind=import");
		return;
	}
	try {
		await Promise.all([fetchAdd(), fetchImport()]);
		// 追加申請が無く、インポート申請だけある人はインポートのタブから見せる
		if (props.kind == null && addItems.value.length === 0 && importItems.value.length > 0) {
			tab.value = "import";
		}
	} finally {
		loading.value = false;
	}
});

definePageMetadata({
	title: "絵文字申請",
	icon: "ph-smiley-sticker ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.empty {
	padding: 16px 0;
	text-align: center;
	opacity: 0.6;
}

.groupHead {
	margin: 0 0 8px;
	font-weight: bold;
	color: var(--warn);
}

.list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 0 0 16px;
}

.item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--panel);
	color: inherit;

	&:hover {
		text-decoration: none;
		background: var(--panelHighlight);
	}
}

.itemAction {
	outline: solid 2px var(--warn);
	outline-offset: -2px;
}

.thumb {
	flex: none;
	width: 40px;
	height: 40px;
	object-fit: contain;
}

.thumbEmoji {
	flex: none;
	width: 40px !important;
	height: 40px !important;
	object-fit: contain;
}

.body {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	flex: 1;
}

.name {
	font-weight: bold;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.date {
	font-size: 0.8em;
	opacity: 0.6;
}

.badge {
	flex: none;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 0.75em;
	color: #fff;
}

.info {
	background: var(--accent);
}

.warn {
	background: var(--warn);
}

.success {
	background: var(--success);
}

.error {
	background: var(--error);
}

.dim {
	background: var(--buttonBg);
	color: var(--fg);
}

.more {
	margin: 0 0 16px;
}
</style>
