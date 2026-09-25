<template>
	<div>
		<div :class="$style.section">
			<div :class="$style.sectionTitle">申請内容</div>
			<div v-for="row in contentRows" :key="row.key" :class="$style.row">
				<span :class="$style.rowLabel">{{ row.label }}</span>
				<span :class="$style.rowValue">{{ row.value }}</span>
			</div>
			<div v-if="request.message" :class="$style.row">
				<span :class="$style.rowLabel">メッセージ</span>
				<span :class="$style.rowValue">{{ request.message }}</span>
			</div>
		</div>

		<div v-if="request.history.length > 0" :class="$style.section">
			<div :class="$style.sectionTitle">経緯</div>
			<div v-for="(h, i) in [...request.history].reverse()" :key="i" :class="$style.history">
				<div>
					<span :class="$style.historyAction">{{ HISTORY_ACTION_LABELS[h.action] ?? h.action }}</span>
					<span :class="$style.date">{{ formatRequestDate(h.at) }}・{{ actorOf(h.by) }}</span>
				</div>
				<div v-if="h.comment" :class="$style.historyComment">{{ h.comment }}</div>
				<div v-if="viewer === 'reviewer' && h.changes && Object.keys(h.changes).length > 0" :class="$style.historyComment">
					変えた項目：{{ changedLabels(h.changes) }}
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 追加申請の「申請内容」と「経緯」の表示（申請者の詳細ページと、審査画面で共通）。
 *
 * @remarks
 * - 申請内容は空の項目を出さない。文字だけの絵文字では、ライセンス関係の項目を出さない（承認時に固定値になるため）
 * - 経緯の「誰が」は、申請者が見るときは「あなた／管理者」、管理者が見るときは「申請者／管理者」とだけ出す
 *   （管理者の名前は申請者に見せない）
 * - 管理者が見るときだけ、経緯ごとに変えた項目の名前も出す
 *
 * @internal
 */
import { computed } from "vue";
import {
	EMOJI_ADD_REQUEST_FIELD_LABELS,
	EMOJI_ADD_REQUEST_FIELD_ORDER,
	HISTORY_ACTION_LABELS,
	formatEmojiAddRequestField,
	formatRequestDate,
	type EmojiAddRequestFields,
	type PackedEmojiAddRequest,
} from "@/scripts/emoji-request";

const props = defineProps<{
	request: PackedEmojiAddRequest;
	/** 誰が見ているか（経緯の書き方が変わる） */
	viewer: "requester" | "reviewer";
}>();

/** 文字だけの絵文字のときに出さない項目 */
const LICENSE_KEYS: ReadonlyArray<keyof EmojiAddRequestFields> = [
	"motifSelf",
	"motifUserMode",
	"copyPermission",
	"askContact",
	"licenseName",
	"creator",
	"usageInfo",
	"copyrightNotice",
	"creditText",
	"relatedLinks",
];

const contentRows = computed(() => {
	const r = props.request;
	return EMOJI_ADD_REQUEST_FIELD_ORDER.filter((k) => k !== "fileId")
		.filter((k) => !(r.isTextOnly && LICENSE_KEYS.includes(k)))
		.map((k) => ({ key: k, label: EMOJI_ADD_REQUEST_FIELD_LABELS[k], value: formatEmojiAddRequestField(k, r[k], r) }))
		.filter((row) => row.value !== "" && !(row.key === "sensitive" && row.value === "いいえ"));
});

/**
 * 経緯の「誰が」を返す。
 *
 * @param by - 操作した人のユーザー ID
 * @returns 表示する名前
 */
function actorOf(by: string | null): string {
	if (by != null && by === props.request.requesterId) return props.viewer === "requester" ? "あなた" : "申請者";
	return "管理者";
}

/**
 * 変えた項目の名前を並べる。
 *
 * @param changes - 変えた項目
 * @returns 例「絵文字名、カテゴリ」
 */
function changedLabels(changes: Partial<EmojiAddRequestFields>): string {
	return (Object.keys(changes) as Array<keyof EmojiAddRequestFields>)
		.map((k) => EMOJI_ADD_REQUEST_FIELD_LABELS[k])
		.join("、");
}
</script>

<style lang="scss" module>
.section {
	margin: 0 0 16px;
	padding: 10px 12px;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.sectionTitle {
	margin: 0 0 6px;
	font-weight: bold;
}

.row {
	display: flex;
	gap: 12px;
	padding: 4px 0;
	font-size: 0.9em;
}

.rowLabel {
	flex: none;
	width: 7em;
	opacity: 0.7;
}

.rowValue {
	min-width: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.date {
	font-size: 0.8em;
	opacity: 0.6;
}

.history {
	padding: 6px 0;
	border-top: solid 1px var(--divider);
	font-size: 0.9em;

	&:first-of-type {
		border-top: none;
	}
}

.historyAction {
	font-weight: bold;
	margin-right: 8px;
}

.historyComment {
	margin: 2px 0 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
	opacity: 0.85;
}
</style>
