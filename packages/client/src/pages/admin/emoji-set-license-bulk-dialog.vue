<template>
	<MkModalWindow
		ref="dialogRef"
		:width="440"
		:with-ok-button="true"
		@close="dialogRef?.close()"
		@closed="$emit('closed')"
		@ok="ok()"
	>
		<template #header>{{ i18n.ts._adminEmoji?.setLicenseBulkTitle ?? "一括ライセンス設定" }}</template>
		<div class="_monolithic_">
			<p class="_caption">
				{{ i18n.ts._adminEmoji?.setLicenseBulkCaption ?? "入力した項目のみ対象絵文字に反映します。空欄の項目は変更しません。" }}
			</p>
			<MkSelect v-model="usageVisibility" class="_formBlock">
				<template #label>{{ i18n.ts._adminEmoji?.usageVisibility ?? "使用可能状態" }}</template>
				<option value="">変更しない</option>
				<option value="public">全公開</option>
				<option value="limited">限定公開（検索のみ）</option>
				<option value="user">ユーザ指定</option>
				<option value="private">非公開</option>
			</MkSelect>
			<MkInput
				v-if="usageVisibility === 'user'"
				v-model="allowedUserIdsStr"
				class="_formBlock"
			>
				<template #label>{{ i18n.ts._adminEmoji?.allowedUserIds ?? "許可ユーザ ID" }}</template>
				<template #caption>スペースまたはカンマ区切り</template>
			</MkInput>
			<MkSelect v-model="sensitive" class="_formBlock">
				<template #label>{{ i18n.ts.sensitive ?? "センシティブ" }}</template>
				<option value="">変更しない</option>
				<option value="true">する</option>
				<option value="false">しない</option>
			</MkSelect>
			<MkSelect v-model="isTextOnly" class="_formBlock">
				<template #label>{{ i18n.ts.isTextOnlyEmoji ?? "文字だけ絵文字" }}</template>
				<option value="">変更しない</option>
				<option value="true">する</option>
				<option value="false">しない</option>
			</MkSelect>
			<MkSelect v-model="copyPermission" class="_formBlock" :disabled="isTextOnly">
				<template #label>{{ i18n.ts.copyPermission }}</template>
				<option value="">変更しない</option>
				<option value="allow">{{ i18n.ts._copyPermission?.allow ?? "allow" }}</option>
				<option value="deny">{{ i18n.ts._copyPermission?.deny ?? "deny" }}</option>
				<option value="conditional">{{ i18n.ts._copyPermission?.conditional ?? "conditional" }}</option>
				<option value="none">{{ i18n.ts._copyPermission?.none ?? "none" }}</option>
			</MkSelect>
			<MkSelect v-model="licenseName" class="_formBlock" :disabled="isTextOnly">
				<template #label>{{ i18n.ts.licenseName ?? "ライセンス名" }}</template>
				<option value="">変更しない</option>
				<option value="CC0 1.0 Universal">CC0 1.0 Universal</option>
				<option value="CC BY 4.0">CC BY 4.0</option>
				<option value="CC BY-NC 4.0">CC BY-NC 4.0</option>
				<option value="CC BY-NC-SA 4.0">CC BY-NC-SA 4.0</option>
				<option value="CC BY-NC-ND 4.0">CC BY-NC-ND 4.0</option>
				<option value="Public Domain">Public Domain</option>
			</MkSelect>
			<MkInput v-model="creator" class="_formBlock" :disabled="isTextOnly">
				<template #label>{{ i18n.ts.emojiAuthor ?? "製作者" }}</template>
			</MkInput>
			<MkTextarea v-model="usageInfo" class="_formBlock">
				<template #label>{{ i18n.ts.usageInfo ?? "使用情報" }}</template>
			</MkTextarea>
			<MkInput v-model="isBasedOnUrl" class="_formBlock">
				<template #label>{{ i18n.ts.isBasedOnUrl ?? "コピー元URL" }}</template>
			</MkInput>
			<MkTextarea v-model="description" class="_formBlock">
				<template #label>{{ i18n.ts.emojiDescription ?? "説明" }}</template>
			</MkTextarea>
			<MkTextarea v-model="license" class="_formBlock">
				<template #label>{{ i18n.ts.licenseSupplement ?? "ライセンス補足情報" }}</template>
			</MkTextarea>
			<MkInput v-model="motifUserId" class="_formBlock">
				<template #label>{{ i18n.ts._adminEmoji?.motifUserId ?? "モチーフユーザー ID" }}</template>
			</MkInput>
			<MkSelect v-model="motifUserMode" class="_formBlock">
				<template #label>{{ i18n.ts._adminEmoji?.motifUserMode ?? "モチーフの利用範囲" }}</template>
				<option value="">変更しない</option>
				<option value="any">誰でも使える</option>
				<option value="follow">フォロー限定</option>
				<option value="owner">そのユーザ限定</option>
			</MkSelect>
		</div>
	</MkModalWindow>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字一括ライセンス設定ダイアログ。選択した絵文字に対し、入力した項目のみを set-license-bulk で反映する。
 * 空欄の項目は API に渡さず変更しない。
 *
 * @public
 */
import { ref, computed } from "vue";
import MkModalWindow from "@/components/MkModalWindow.vue";
import MkInput from "@/components/form/input.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkSelect from "@/components/form/select.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";

const props = defineProps<{
	emojiIds: string[];
}>();

const emit = defineEmits<{
	(ev: "done"): void;
}>();

const dialogRef = ref<InstanceType<typeof MkModalWindow>>();

const usageVisibility = ref("");
const allowedUserIdsStr = ref("");
const sensitive = ref("");
const isTextOnly = ref("");
const copyPermission = ref("");
const licenseName = ref("");
const creator = ref("");
const usageInfo = ref("");
const isBasedOnUrl = ref("");
const description = ref("");
const license = ref("");
const motifUserId = ref("");
const motifUserMode = ref("");

function trim(s: string): string {
	return s?.trim() ?? "";
}

function buildPayload(): Record<string, unknown> {
	const body: Record<string, unknown> = { ids: props.emojiIds };
	if (usageVisibility.value !== "") body.usageVisibility = usageVisibility.value;
	if (usageVisibility.value === "user" && trim(allowedUserIdsStr.value)) {
		body.allowedUserIds = allowedUserIdsStr.value
			.split(/[\s,]+/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	if (sensitive.value !== "") body.sensitive = sensitive.value === "true";
	if (isTextOnly.value !== "") body.isTextOnly = isTextOnly.value === "true";
	if (copyPermission.value !== "") body.copyPermission = copyPermission.value;
	if (licenseName.value !== "") body.licenseName = licenseName.value;
	if (trim(creator.value) !== "") body.creator = trim(creator.value);
	if (trim(usageInfo.value) !== "") body.usageInfo = trim(usageInfo.value);
	if (trim(isBasedOnUrl.value) !== "") body.isBasedOnUrl = trim(isBasedOnUrl.value);
	if (trim(description.value) !== "") body.description = trim(description.value);
	if (trim(license.value) !== "") body.license = trim(license.value);
	if (trim(motifUserId.value) !== "") body.motifUserId = trim(motifUserId.value);
	if (motifUserMode.value !== "") body.motifUserMode = motifUserMode.value;
	return body;
}

async function ok() {
	const body = buildPayload();
	await os.apiWithDialog("admin/emoji/set-license-bulk", body);
	emit("done");
	dialogRef.value?.close();
}
</script>
