<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader v-model:tab="tab" :tabs="headerTabs" :display-back-button="true" />
		</template>
		<MkSpacer :content-max="900">
			<!-- #region 追加申請 -->
			<template v-if="tab === 'add'">
				<div :class="$style.filters">
					<button
						v-for="f in ADD_FILTERS"
						:key="f.key"
						class="_button"
						:class="[$style.filter, { [$style.filterOn]: statusFilter === f.key }]"
						@click="statusFilter = f.key"
					>
						{{ f.label }}<span v-if="addCounts[f.key]" :class="$style.count">{{ addCounts[f.key] }}</span>
					</button>
				</div>

				<div v-if="selectable && items.length > 0" :class="$style.bulk">
					<label :class="$style.checkAll">
						<input type="checkbox" :checked="allSelected" @change="toggleAll" />
						すべて選ぶ
					</label>
					<MkButton primary inline :disabled="selected.size === 0 || approving" @click="approveSelected">
						<i class="ph-check ph-bold"></i> 選んだ {{ selected.size }} 件を承認
					</MkButton>
				</div>

				<div v-if="loading" :class="$style.empty">読み込んでいます…</div>
				<div v-else-if="items.length === 0" :class="$style.empty">申請はありません</div>
				<div v-else :class="$style.list">
					<div v-for="r in items" :key="r.id" :class="$style.item">
						<input
							v-if="selectable"
							type="checkbox"
							:class="$style.check"
							:checked="selected.has(r.id)"
							@change="toggle(r.id)"
						/>
						<MkA :to="`/admin/emoji-requests/add/${r.id}`" :class="$style.link">
							<div :class="$style.thumbBox">
								<img v-if="r.file" :src="r.file.url" :class="$style.thumb" alt="" />
							</div>
							<div :class="$style.body">
								<span :class="$style.name">:{{ r.name }}:</span>
								<span :class="$style.sub">
									{{ r.requester ? `@${r.requester.username}` : "申請者不明" }}・{{ formatRequestDate(r.createdAt) }}
								</span>
								<div :class="$style.tags">
									<span v-for="w in warningsOf(r)" :key="w.label" :class="[$style.tag, $style[w.tone]]">{{ w.label }}</span>
								</div>
							</div>
						</MkA>
					</div>
				</div>
				<MkButton v-if="hasMore" full :class="$style.more" @click="fetchAdd(true)">もっと見る</MkButton>
			</template>
			<!-- #endregion -->

			<MkAdminEmojiImportRequests v-else-if="tab === 'import'" :key="importReloadKey" @counts="(c) => (importPending = c.pending ?? 0)" />
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 管理者向けの絵文字申請の審査画面（`/admin/emoji-requests`）。追加申請とインポート申請を種類で切り替える（G1）。
 *
 * @remarks
 * - タブに種類ごとの審査待ちの件数を出す
 * - 追加申請は縦の一覧で、画像・名前・申請者と、気をつける点（札）を出す。行を押すとその申請の審査画面を開く
 *   - 札：名前が使えない・同じ名前の絵文字がある・サイズが大きめ・左右に余白・文字だけ・申請者が加工済み
 *   - 余白はブラウザで画像を読んで調べる（審査待ちのときだけ。1 枚ずつ順に）
 * - 審査待ちでは、選んでまとめて承認できる。1 件ずつ承認 API を呼び、失敗したものは理由をまとめて出す
 * - 古い URL（`/admin/emoji-import-requests`）から来たときは、インポート申請のタブに置き換える（G2）
 * TODO: 第 1 段階 B で「変更申請」のタブを足す
 * OPTIMIZE: 余白の判定は一覧を開くたびに画像を読み直している。件数が増えて重くなったら、申請時の判定結果を保存する
 *
 * @internal
 */
import { computed, onActivated, onMounted, ref, watch } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkAdminEmojiImportRequests from "@/components/emoji-request/MkAdminEmojiImportRequests.vue";
import * as os from "@/os";
import { useRouter } from "@/router";
import { emojiMap } from "@/instance";
import { definePageMetadata } from "@/scripts/page-metadata";
import { analyzeEmojiImage } from "@/scripts/emoji-image-tools";
import { isOverRecommendedPixels } from "@/scripts/emoji-image-analysis";
import { formatRequestDate, type PackedEmojiAddRequest } from "@/scripts/emoji-request";

const props = defineProps<{
	/** 最初に開く種類（"add" / "import"） */
	kind?: string;
}>();

const router = useRouter();

// #region 定数

/** 追加申請の状態の切り替え */
const ADD_FILTERS = [
	{ key: "pending", label: "審査待ち" },
	{ key: "changesRequested", label: "修正のお願い中" },
	{ key: "approved", label: "承認済み" },
	{ key: "rejected", label: "見送り" },
	{ key: "withdrawn", label: "取り下げ" },
] as const;

type AddFilter = (typeof ADD_FILTERS)[number]["key"];

/** 1 回に取る件数 */
const PAGE_SIZE = 50;

/** API のエラーの code から、まとめて承認の結果に出す文 */
const APPROVE_ERRORS: Record<string, string> = {
	DUPLICATE_EMOJI_NAME: "同じ名前の絵文字がある",
	INVALID_NAME: "名前が使えない",
	MOTIF_REQUIRED: "モチーフが未回答",
	USAGE_INFO_REQUIRED: "使用情報が無い",
	NO_SUCH_FILE: "画像が無い",
	INVALID_STATUS: "既に処理済み",
};

// #endregion

// #region 状態

const tab = ref<"add" | "import">(props.kind === "import" ? "import" : "add");
const statusFilter = ref<AddFilter>("pending");
const items = ref<PackedEmojiAddRequest[]>([]);
const addCounts = ref<Record<string, number>>({});
const importPending = ref(0);
/** インポート申請の部品を作り直して読み直させるための番号 */
const importReloadKey = ref(0);
const hasMore = ref(false);
const loading = ref(true);
const approving = ref(false);
const selected = ref(new Set<string>());
/** 左右に余白がある申請の ID（画像を読んで調べた結果） */
const marginWarned = ref(new Set<string>());

const headerTabs = computed(() => [
	{
		key: "add",
		title: `追加申請${addCounts.value.pending ? `（${addCounts.value.pending}）` : ""}`,
		icon: "ph-plus-circle ph-bold ph-lg",
	},
	{
		key: "import",
		title: `インポート申請${importPending.value ? `（${importPending.value}）` : ""}`,
		icon: "ph-download-simple ph-bold ph-lg",
	},
]);

/** 選んで承認できる状態か（修正のお願い中も、管理者の判断で承認できる） */
const selectable = computed(() => statusFilter.value === "pending" || statusFilter.value === "changesRequested");
const allSelected = computed(() => items.value.length > 0 && items.value.every((r) => selected.value.has(r.id)));

// #endregion

// #region 一覧

/**
 * 追加申請を取る。
 *
 * @param more - true なら続きを取って後ろに足す
 */
async function fetchAdd(more = false): Promise<void> {
	if (!more) loading.value = true;
	try {
		const res = await os.api("emoji-add-request/list", {
			status: statusFilter.value,
			limit: PAGE_SIZE,
			offset: more ? items.value.length : 0,
		});
		const got = res.items as PackedEmojiAddRequest[];
		items.value = more ? [...items.value, ...got] : got;
		addCounts.value = res.counts ?? {};
		hasMore.value = got.length === PAGE_SIZE;
		if (!more) selected.value = new Set();
		if (selectable.value) void checkMargins(got);
	} finally {
		loading.value = false;
	}
}

/**
 * 画像を読んで、左右の余白を調べる（1 枚ずつ順に）。
 *
 * @param list - 調べる申請
 */
async function checkMargins(list: PackedEmojiAddRequest[]): Promise<void> {
	for (const r of list) {
		if (r.file == null) continue;
		try {
			const blob = await (await fetch(r.file.url)).blob();
			if ((await analyzeEmojiImage(blob)).marginWarning) {
				marginWarned.value = new Set(marginWarned.value).add(r.id);
			}
		} catch {
			// 読めない画像は札を出さない（審査画面で確かめられる）
		}
	}
}

/**
 * 一覧の札（気をつける点）を返す。
 *
 * @param r - 申請
 * @returns 札の一覧
 */
function warningsOf(r: PackedEmojiAddRequest): { label: string; tone: "warn" | "error" | "info" }[] {
	const out: { label: string; tone: "warn" | "error" | "info" }[] = [];
	if (!/^[a-z0-9_]+$/.test(r.name)) out.push({ label: "名前が使えない", tone: "error" });
	else if (emojiMap.value.has(r.name)) out.push({ label: "同じ名前の絵文字がある", tone: "error" });
	if (r.file?.width && r.file?.height && isOverRecommendedPixels(r.file.width, r.file.height)) {
		out.push({ label: "サイズ大きめ", tone: "warn" });
	}
	if (marginWarned.value.has(r.id)) out.push({ label: "左右に余白", tone: "warn" });
	if (r.imageProcessed) out.push({ label: "申請者が加工済み", tone: "info" });
	if (r.isTextOnly) out.push({ label: "文字だけ", tone: "info" });
	if (r.message) out.push({ label: "メッセージあり", tone: "info" });
	return out;
}

// #endregion

// #region 選んで承認

function toggle(id: string): void {
	const next = new Set(selected.value);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	selected.value = next;
}

function toggleAll(): void {
	selected.value = allSelected.value ? new Set() : new Set(items.value.map((r) => r.id));
}

/** 選んだ申請を、そのままの内容で承認する */
async function approveSelected(): Promise<void> {
	const targets = items.value.filter((r) => selected.value.has(r.id));
	if (targets.length === 0) return;
	const { canceled } = await os.confirm({
		type: "question",
		text: `選んだ ${targets.length} 件を、そのままの内容で承認しますか？`,
	});
	if (canceled) return;
	approving.value = true;
	const failures: string[] = [];
	try {
		// 同じ名前の申請が並んでいると 2 件目が失敗するので、並行ではなく 1 件ずつ送る
		for (const r of targets) {
			try {
				await os.api("emoji-add-request/approve", { requestId: r.id });
			} catch (err: any) {
				failures.push(`:${r.name}:（${APPROVE_ERRORS[err?.code] ?? err?.message ?? "不明なエラー"}）`);
			}
		}
	} finally {
		approving.value = false;
	}
	if (failures.length === 0) {
		os.success();
	} else {
		await os.alert({
			type: "warning",
			text: `${targets.length - failures.length} 件を承認しました。次の申請は承認できませんでした。\n${failures.join("\n")}`,
		});
	}
	fetchAdd();
}

// #endregion

watch(statusFilter, () => fetchAdd());

// NOTE: ページはルーターに保持（KeepAlive）されるので、一度開いたページに戻ると onMounted は動かない。
// 申請や審査で内容が変わっているかもしれないので、2 回目以降に表示されたときは読み直す
let activatedOnce = false;
onActivated(() => {
	if (activatedOnce) {
		void fetchAdd();
		importReloadKey.value++;
	}
	activatedOnce = true;
});

onMounted(async () => {
	// 古い URL から来たときは、新しい URL に置き換える（置き換え先でこのページが開き直される）
	if (router.getCurrentPath().startsWith("/admin/emoji-import-requests")) {
		router.replace("/admin/emoji-requests?kind=import");
		return;
	}
	await fetchAdd();
	// インポート申請のタブを開いていなくても、件数だけは出しておく
	if (tab.value !== "import") {
		os.api("emoji-import-request/list", { status: "pending", limit: 1 }).then((res) => {
			importPending.value = res.counts?.pending ?? 0;
		});
	}
});

definePageMetadata({
	title: "絵文字申請",
	icon: "ph-smiley-sticker ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.filters {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0 0 12px;
}

.filter {
	padding: 6px 12px;
	border-radius: 999px;
	background: var(--buttonBg);
}

.filterOn {
	background: var(--accent);
	color: var(--fgOnAccent);
}

.count {
	margin-left: 6px;
	font-size: 0.8em;
	opacity: 0.85;
}

.bulk {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin: 0 0 12px;
}

.checkAll {
	display: flex;
	align-items: center;
	gap: 6px;
	cursor: pointer;
}

.empty {
	padding: 16px 0;
	text-align: center;
	opacity: 0.6;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--panel);
}

.check {
	flex: none;
	width: 20px;
	height: 20px;
}

.link {
	display: flex;
	align-items: center;
	gap: 12px;
	flex: 1;
	min-width: 0;
	color: inherit;

	&:hover {
		text-decoration: none;
	}
}

.thumbBox {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 96px;
	height: 56px;
	border-radius: 8px;
	background: var(--bg);
}

.thumb {
	max-width: 90px;
	max-height: 48px;
	object-fit: contain;
}

.body {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.name {
	font-weight: bold;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.sub {
	font-size: 0.8em;
	opacity: 0.7;
}

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
}

.tag {
	padding: 1px 6px;
	border-radius: 6px;
	font-size: 0.75em;
}

.warn {
	background: var(--warn);
	color: #fff;
}

.error {
	background: var(--error);
	color: #fff;
}

.info {
	background: var(--buttonBg);
}

.more {
	margin: 12px 0 0;
}
</style>
