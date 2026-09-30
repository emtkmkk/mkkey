<template>
	<div>
		<div v-if="!onlyId" :class="$style.filters">
			<button
				v-for="f in FILTERS"
				:key="f.key"
				class="_button"
				:class="[$style.filter, { [$style.filterOn]: statusFilter === f.key }]"
				@click="statusFilter = f.key"
			>
				{{ f.label }}<span v-if="counts[f.key]" :class="$style.count">{{ counts[f.key] }}</span>
			</button>
		</div>

		<div v-if="loading" :class="$style.empty">読み込んでいます…</div>
		<div v-else-if="items.length === 0" :class="$style.empty">
			{{ onlyId ? "この申請は見つかりませんでした（承認済みの可能性があります）" : "申請はありません" }}
		</div>
		<div v-else :class="$style.list">
			<div v-for="r in items" :key="r.id" :class="$style.item">
				<MkEmoji :emoji="`:${r.emojiName}@${r.emojiHost}:`" normal :class="$style.emoji" />
				<div :class="$style.body">
					<span :class="$style.name">:{{ r.emojiName }}@{{ r.emojiHost }}:</span>
					<MkA v-if="r.requester" :to="`/@${r.requester.username}${r.requester.host ? `@${r.requester.host}` : ''}`" :class="$style.sub">
						@{{ r.requester.username }}{{ r.requester.host ? `@${r.requester.host}` : "" }}
					</MkA>
					<span :class="$style.sub">{{ formatRequestDate(r.createdAt) }}</span>
					<p v-if="r.status === 'rejected' && r.reason" :class="$style.reason">{{ r.reason }}</p>
					<div :class="$style.actions">
						<template v-if="r.status === 'pending'">
							<MkButton primary inline @click="approve(r)">承認</MkButton>
							<MkButton danger inline @click="reject(r)">見送る</MkButton>
						</template>
						<MkButton v-else-if="r.status === 'rejected'" primary inline @click="approve(r)">改めて承認</MkButton>
						<MkButton inline @click="openDetail(r)">絵文字の詳細</MkButton>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 管理者向けの、絵文字のインポート申請の審査（承認・見送り・絵文字の詳細）。
 *
 * @remarks
 * 審査画面（`/admin/emoji-requests`）の「インポート申請」タブと、通知から開くその申請の画面で共通に使う。
 * もとは `pages/admin/emoji-import-requests.vue` にあった処理を、審査画面へまとめるために部品にした（G1）。
 * - onlyId を渡すと、その申請 1 件だけを出す（1 件を取る API が無いので、審査待ちと見送りの一覧から探す）
 * - 状態ごとの件数を counts で親に知らせる（タブの件数に使う）
 * - 承認では、ローカルに同じ名前の絵文字があるときだけ新しい名前を聞く（今までと同じ）
 *
 * @internal
 */
import { onMounted, ref, watch } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkEmoji from "@/components/global/MkEmoji.vue";
import MkCustomEmojiDetailedDialog from "@/components/MkCustomEmojiDetailedDialog.vue";
import * as os from "@/os";
import { formatRequestDate } from "@/scripts/emoji-request";

const props = defineProps<{
	/** この申請だけを出す */
	onlyId?: string;
}>();

const emit = defineEmits<{
	(ev: "counts", v: Record<string, number>): void;
}>();

/** 一覧で切り替える状態 */
const FILTERS = [
	{ key: "pending", label: "審査待ち" },
	{ key: "rejected", label: "見送り" },
] as const;

/** 管理者向けのインポート申請（emoji-import-request/list の 1 件） */
type AdminImportRequest = {
	id: string;
	emojiName: string;
	emojiHost: string;
	requester: { id: string; username: string; host: string | null } | null;
	status: "pending" | "approved" | "rejected";
	reason: string | null;
	createdAt: string;
};

const statusFilter = ref<"pending" | "rejected">("pending");
const items = ref<AdminImportRequest[]>([]);
const counts = ref<Record<string, number>>({});
const loading = ref(true);

async function fetchList(): Promise<void> {
	loading.value = true;
	try {
		if (props.onlyId) {
			const [p, r] = await Promise.all([
				os.api("emoji-import-request/list", { status: "pending", limit: 100 }),
				os.api("emoji-import-request/list", { status: "rejected", limit: 100 }),
			]);
			items.value = [...(p.items ?? []), ...(r.items ?? [])].filter((x: AdminImportRequest) => x.id === props.onlyId);
			counts.value = p.counts ?? {};
		} else {
			const res = await os.api("emoji-import-request/list", { status: statusFilter.value, limit: 50 });
			items.value = res.items ?? [];
			counts.value = res.counts ?? {};
		}
		emit("counts", counts.value);
	} finally {
		loading.value = false;
	}
}

watch(statusFilter, fetchList);
onMounted(fetchList);

/**
 * 承認する。同じ名前の絵文字がローカルにあるときは、新しい名前を聞き直す。
 *
 * @param r - 申請
 */
async function approve(r: AdminImportRequest): Promise<void> {
	const { canceled, result: newName } = await os.inputText({
		title: "承認",
		text: "同じ名前の絵文字がローカルに既にある場合だけ、重複しない新しい絵文字名を入力してください。無ければ空で構いません。",
		placeholder: r.emojiName,
		default: "",
	});
	if (canceled) return;
	try {
		await os.api("emoji-import-request/approve", {
			requestId: r.id,
			newEmojiName: newName?.trim() || undefined,
		});
		os.success();
		fetchList();
	} catch (err: any) {
		if (err?.code === "NEW_EMOJI_NAME_REQUIRED") {
			os.toast("同じ名前の絵文字がローカルにあります。新しい絵文字名を入力して、もう一度承認してください。");
			approve(r);
			return;
		}
		if (err?.code === "NEW_EMOJI_NAME_CONFLICT") {
			os.toast("指定した絵文字名は既に使われています。別の名前を入力してください。");
			approve(r);
			return;
		}
		os.toast(err?.message ?? String(err));
	}
}

/**
 * 見送る（理由は任意。申請者の詳細ページに出る）。
 *
 * @param r - 申請
 */
async function reject(r: AdminImportRequest): Promise<void> {
	const { canceled, result: reason } = await os.inputText({
		title: "見送る",
		text: "理由（任意。申請者に表示されます）",
		default: "",
	});
	if (canceled) return;
	try {
		await os.api("emoji-import-request/reject", { requestId: r.id, reason: reason?.trim() || null });
		os.success();
		fetchList();
	} catch (err: any) {
		os.toast(err?.message ?? String(err));
	}
}

/** 元の（リモートの）絵文字の詳細を開く */
function openDetail(r: AdminImportRequest): void {
	os.apiGet("emoji", { name: r.emojiName, host: r.emojiHost }).then((res) => {
		os.popup(MkCustomEmojiDetailedDialog, { emoji: res }, {}, "closed");
	});
}
</script>

<style lang="scss" module>
.filters {
	display: flex;
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
	gap: 12px;
	padding: 12px;
	border-radius: 10px;
	background: var(--panel);
}

.emoji {
	flex: none;
	width: 48px !important;
	height: 48px !important;
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
	overflow-wrap: anywhere;
}

.sub {
	font-size: 0.85em;
	opacity: 0.7;
}

.reason {
	margin: 4px 0 0;
	white-space: pre-wrap;
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin: 6px 0 0;
}
</style>
