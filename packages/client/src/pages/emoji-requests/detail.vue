<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :display-back-button="true" />
		</template>
		<MkSpacer :content-max="600">
			<div v-if="error" :class="$style.empty">申請が見つかりませんでした。</div>
			<div v-else-if="loading" :class="$style.empty">読み込んでいます…</div>

			<!-- #region 追加申請 -->
			<template v-else-if="addRequest">
				<div :class="$style.head">
					<img v-if="addRequest.file" :src="addRequest.file.url" :class="$style.headImage" alt="" />
					<div :class="$style.headBody">
						<div :class="$style.headName">:{{ addRequest.name }}:</div>
						<span :class="[$style.badge, $style[statusOf(addRequest.status).tone]]">
							{{ statusOf(addRequest.status).label }}
						</span>
						<div :class="$style.date">申請：{{ formatRequestDate(addRequest.createdAt) }}</div>
					</div>
				</div>

				<!-- 修正のお願い -->
				<div v-if="addRequest.status === 'changesRequested'" :class="[$style.box, $style.boxWarn]">
					<div :class="$style.boxTitle"><i class="ph-chat-circle-text ph-bold"></i> 管理者から修正のお願いが届きました</div>
					<p v-if="addRequest.reviewComment" :class="$style.comment">{{ addRequest.reviewComment }}</p>
					<template v-if="proposalRows.length > 0">
						<div :class="$style.subTitle">管理者の提案</div>
						<div v-for="row in proposalRows" :key="row.key" :class="$style.diff">
							<div :class="$style.diffLabel">{{ row.label }}</div>
							<template v-if="row.key === 'fileId'">
								<div :class="$style.diffImages">
									<img v-if="addRequest.file" :src="addRequest.file.url" alt="" />
									<i class="ph-arrow-right ph-bold"></i>
									<img v-if="addRequest.proposalFileUrl" :src="addRequest.proposalFileUrl" alt="" />
								</div>
							</template>
							<template v-else>
								<div :class="$style.diffBefore">{{ row.before || "（なし）" }}</div>
								<div :class="$style.diffAfter">{{ row.after || "（なし）" }}</div>
							</template>
						</div>
					</template>
					<div :class="$style.actions">
						<MkButton v-if="proposalRows.length > 0" primary full :disabled="working" @click="acceptProposal()">
							<i class="ph-check ph-bold"></i> この内容で再申請
						</MkButton>
						<MkButton full :disabled="working" @click="router.push(`/emoji-requests/new?resubmit=${addRequest.id}`)">
							<i class="ph-pencil-simple ph-bold"></i> 自分で直して再申請
						</MkButton>
						<MkButton full danger :disabled="working" @click="withdraw()">
							取り下げる
						</MkButton>
					</div>
				</div>

				<!-- 審査待ち -->
				<div v-else-if="addRequest.status === 'pending'" :class="$style.box">
					<div :class="$style.boxTitle"><i class="ph-clock ph-bold"></i> 管理者の確認を待っています</div>
					<p :class="$style.caption">結果は通知でお知らせします。</p>
					<div :class="$style.actions">
						<MkButton full danger :disabled="working" @click="withdraw()">取り下げる</MkButton>
					</div>
				</div>

				<!-- 承認 -->
				<div v-else-if="addRequest.status === 'approved'" :class="[$style.box, $style.boxSuccess]">
					<div :class="$style.boxTitle"><i class="ph-check-circle ph-bold"></i> サーバーに追加されました</div>
					<button class="_button" :class="$style.approvedEmoji" @click="openEmojiMenu">
						<MkEmoji :emoji="`:${addRequest.name}:`" normal />
						<span>:{{ addRequest.name }}:</span>
					</button>
					<template v-if="approvedChanges.length > 0">
						<div :class="$style.subTitle">管理者が直した項目</div>
						<div v-for="row in approvedChanges" :key="row.key" :class="$style.diff">
							<div :class="$style.diffLabel">{{ row.label }}</div>
							<div v-if="row.key !== 'fileId'" :class="$style.diffAfter">{{ row.after || "（なし）" }}</div>
							<div v-else :class="$style.diffAfter">画像を直しました</div>
						</div>
					</template>
					<p v-if="addRequest.reviewComment" :class="$style.comment">{{ addRequest.reviewComment }}</p>
				</div>

				<!-- 見送り -->
				<div v-else-if="addRequest.status === 'rejected'" :class="[$style.box, $style.boxError]">
					<div :class="$style.boxTitle"><i class="ph-x-circle ph-bold"></i> この申請は見送られました</div>
					<p v-if="addRequest.reviewComment" :class="$style.comment">{{ addRequest.reviewComment }}</p>
				</div>

				<!-- 取り下げ -->
				<div v-else-if="addRequest.status === 'withdrawn'" :class="$style.box">
					<div :class="$style.boxTitle">この申請は取り下げました</div>
				</div>

				<MkEmojiAddRequestSummary :request="addRequest" viewer="requester" />
			</template>
			<!-- #endregion -->

			<!-- #region インポート申請 -->
			<template v-else-if="importRequest">
				<div :class="$style.head">
					<MkEmoji
						:emoji="importRequest.status === 'approved' ? `:${importRequest.emojiName}:` : `:${importRequest.emojiName}@${importRequest.emojiHost}:`"
						normal
						:class="$style.headEmoji"
					/>
					<div :class="$style.headBody">
						<div :class="$style.headName">:{{ importRequest.emojiName }}@{{ importRequest.emojiHost }}:</div>
						<span :class="[$style.badge, $style[statusOf(importRequest.status).tone]]">
							{{ statusOf(importRequest.status).label }}
						</span>
						<div :class="$style.date">申請：{{ formatRequestDate(importRequest.createdAt) }}</div>
						<div v-if="importRequest.processedAt" :class="$style.date">
							{{ importRequest.status === "approved" ? "承認" : "見送り" }}：{{ formatRequestDate(importRequest.processedAt) }}
						</div>
					</div>
				</div>
				<div v-if="importRequest.status === 'pending'" :class="$style.box">
					<div :class="$style.boxTitle"><i class="ph-clock ph-bold"></i> 管理者の確認を待っています</div>
				</div>
				<div v-else-if="importRequest.status === 'approved'" :class="[$style.box, $style.boxSuccess]">
					<div :class="$style.boxTitle"><i class="ph-check-circle ph-bold"></i> サーバーに追加されました</div>
					<button class="_button" :class="$style.approvedEmoji" @click="openEmojiMenu">
						<MkEmoji :emoji="`:${importRequest.emojiName}:`" normal />
						<span>:{{ importRequest.emojiName }}:</span>
					</button>
				</div>
				<div v-else-if="importRequest.status === 'rejected'" :class="[$style.box, $style.boxError]">
					<div :class="$style.boxTitle"><i class="ph-x-circle ph-bold"></i> この申請は見送られました</div>
					<p v-if="importRequest.reason" :class="$style.comment">{{ importRequest.reason }}</p>
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
 * 絵文字申請の詳細ページ（`/emoji-requests/{種類}/{id}`）。通知を押したときにも開く。
 *
 * @remarks
 * - 追加申請（add）：状態、管理者のコメント、修正案（今の値との見比べ）、申請内容、経緯を出す
 *   - 修正のお願い中は［この内容で再申請］［自分で直して再申請］［取り下げる］を出す（R2）。
 *     ［自分で直して再申請］は申請ページを `?resubmit={id}` で開き、元の申請内容と管理者の提案を入れた状態から始める
 *   - 審査待ちのあいだは［取り下げる］を出す
 *   - 直して承認されたときは、経緯の最後の「一部を直して承認」から、直した項目を出す（R1）
 * - インポート申請（import）：1 件を取る API が無いので、自分の申請の一覧から探す
 * 経緯の「誰が」は、申請者本人なら「あなた」、それ以外は「管理者」とだけ出す（管理者の名前は申請者に見せない）。
 *
 * @internal
 */
import { computed, onMounted, ref } from "vue";
import MkButton from "@/components/MkButton.vue";
import MkEmoji from "@/components/global/MkEmoji.vue";
import MkEmojiAddRequestSummary from "@/components/emoji-request/MkEmojiAddRequestSummary.vue";
import * as os from "@/os";
import { useRouter } from "@/router";
import { definePageMetadata } from "@/scripts/page-metadata";
import { openReactionMenu_ } from "@/scripts/reaction-menu";
import {
	EMOJI_ADD_REQUEST_FIELD_LABELS,
	EMOJI_ADD_REQUEST_FIELD_ORDER,
	EMOJI_REQUEST_STATUS,
	formatEmojiAddRequestField,
	formatRequestDate,
	type EmojiAddRequestFields,
	type PackedEmojiAddRequest,
	type PackedEmojiImportRequest,
} from "@/scripts/emoji-request";

const props = defineProps<{
	/** 申請の種類（"add" / "import"） */
	kind: string;
	id: string;
}>();

const router = useRouter();

const loading = ref(true);
const error = ref(false);
const working = ref(false);
const addRequest = ref<PackedEmojiAddRequest | null>(null);
const importRequest = ref<PackedEmojiImportRequest | null>(null);

/**
 * 状態の表示名と色を引く。
 *
 * @param status - 申請の状態
 * @returns 表示名と札の色
 */
function statusOf(status: string) {
	return EMOJI_REQUEST_STATUS[status] ?? { label: status, tone: "dim" as const };
}

// #region 追加申請の表示

/**
 * 変わった項目を「今の値」と「新しい値」の行にする。
 *
 * @param changes - 変わった項目
 * @returns 行の一覧（申請画面の並び順）
 */
function toDiffRows(changes: Partial<EmojiAddRequestFields> | null | undefined) {
	const r = addRequest.value;
	if (r == null || changes == null) return [];
	const merged = { ...r, ...changes };
	return EMOJI_ADD_REQUEST_FIELD_ORDER.filter((k) => k in changes).map((k) => ({
		key: k,
		label: EMOJI_ADD_REQUEST_FIELD_LABELS[k],
		before: formatEmojiAddRequestField(k, r[k], r),
		after: formatEmojiAddRequestField(k, changes[k], merged),
	}));
}

const proposalRows = computed(() => toDiffRows(addRequest.value?.proposal));

/** 直して承認されたときに、直した項目 */
const approvedChanges = computed(() => {
	const last = [...(addRequest.value?.history ?? [])].reverse().find((h) => h.action === "approvedWithChanges");
	return toDiffRows(last?.changes);
});

// #endregion

// #region 操作

/** 管理者の修正案をそのまま使って再申請する */
async function acceptProposal(): Promise<void> {
	const r = addRequest.value;
	if (r == null) return;
	const { canceled } = await os.confirm({
		type: "question",
		text: "管理者の提案した内容で、もう一度申請しますか？",
	});
	if (canceled) return;
	working.value = true;
	try {
		await os.apiWithDialog("emoji-add-request/resubmit", { requestId: r.id, acceptProposal: true });
		await load();
	} finally {
		working.value = false;
	}
}

/** 申請を取り下げる */
async function withdraw(): Promise<void> {
	const r = addRequest.value;
	if (r == null) return;
	const { canceled } = await os.confirm({
		type: "warning",
		text: `:${r.name}: の申請を取り下げますか？\n取り下げた申請は元に戻せません。`,
	});
	if (canceled) return;
	working.value = true;
	try {
		await os.apiWithDialog("emoji-add-request/withdraw", { requestId: r.id });
		await load();
	} finally {
		working.value = false;
	}
}

/** 追加された絵文字のメニュー（コピー・詳細など）を開く */
function openEmojiMenu(ev: MouseEvent): void {
	const name = addRequest.value?.name ?? importRequest.value?.emojiName;
	if (!name) return;
	const el = (ev.currentTarget ?? ev.target) as HTMLElement | null;
	openReactionMenu_(`:${name}:`, null, false, false, el ?? undefined);
}

// #endregion

// #region 読み込み

async function load(): Promise<void> {
	try {
		if (props.kind === "add") {
			addRequest.value = (await os.api("emoji-add-request/show", { requestId: props.id })) as PackedEmojiAddRequest;
		} else if (props.kind === "import") {
			const res = await os.api("emoji-import-request/my-list", {});
			const all = [...(res.pending ?? []), ...(res.approved ?? []), ...(res.rejected ?? [])] as PackedEmojiImportRequest[];
			importRequest.value = all.find((x) => x.id === props.id) ?? null;
			if (importRequest.value == null) error.value = true;
		} else {
			error.value = true;
		}
	} catch {
		error.value = true;
	} finally {
		loading.value = false;
	}
}

onMounted(load);

// #endregion

definePageMetadata(
	computed(() => ({
		title: addRequest.value
			? `:${addRequest.value.name}: の申請`
			: importRequest.value
			? `:${importRequest.value.emojiName}: の申請`
			: "絵文字申請",
		icon: "ph-smiley-sticker ph-bold ph-lg",
	})),
);
</script>

<style lang="scss" module>
.empty {
	padding: 24px 0;
	text-align: center;
	opacity: 0.6;
}

.head {
	display: flex;
	align-items: center;
	gap: 16px;
	margin: 0 0 16px;
}

.headImage {
	flex: none;
	max-width: 40%;
	height: 96px;
	object-fit: contain;
}

.headEmoji {
	flex: none;
	height: 96px !important;
	max-width: 40%;
}

.headBody {
	min-width: 0;
}

.headName {
	font-weight: bold;
	font-size: 1.1em;
	overflow-wrap: anywhere;
}

.date {
	margin: 4px 0 0;
	font-size: 0.8em;
	opacity: 0.6;
}

.badge {
	display: inline-block;
	margin: 4px 0 0;
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

.box {
	margin: 0 0 16px;
	padding: 12px;
	border-radius: 10px;
	background: var(--panel);
	border-left: solid 4px var(--divider);
}

.boxWarn {
	border-left-color: var(--warn);
}

.boxSuccess {
	border-left-color: var(--success);
}

.boxError {
	border-left-color: var(--error);
}

.boxTitle {
	font-weight: bold;
}

.subTitle {
	margin: 12px 0 4px;
	font-size: 0.9em;
	font-weight: bold;
}

.caption {
	margin: 4px 0 0;
	font-size: 0.85em;
	opacity: 0.7;
}

.comment {
	margin: 8px 0 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.diff {
	padding: 6px 0;
	border-top: solid 1px var(--divider);
	font-size: 0.9em;
}

.diffLabel {
	font-size: 0.85em;
	opacity: 0.7;
}

.diffBefore {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	text-decoration: line-through;
	opacity: 0.6;
}

.diffAfter {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	color: var(--accent);
}

.diffImages {
	display: flex;
	align-items: center;
	gap: 8px;

	> img {
		max-width: 40%;
		height: 48px;
		object-fit: contain;
	}
}

.actions {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 12px 0 0;
}

.approvedEmoji {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	margin: 8px 0 0;
	padding: 6px 10px;
	border-radius: 8px;
	background: var(--buttonBg);
}








</style>
