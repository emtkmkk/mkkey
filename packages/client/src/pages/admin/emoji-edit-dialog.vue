<template>
	<XModalWindow
		ref="dialog"
		:width="420"
		:with-ok-button="true"
		@close="$refs.dialog.close()"
		@closed="$emit('closed')"
		@ok="ok()"
	>
		<template #header>:{{ emoji.name }}:</template>

		<div class="_monolithic_">
			<div class="yigymqpb _section">
				<img :src="emoji.url" class="img" />
				<MkInput v-model="name" class="_formBlock">
					<template #label>{{ i18n.ts.name }}</template>
				</MkInput>
				<MkInput
					v-model="category"
					class="_formBlock"
					:datalist="categories"
				>
					<template #label>{{ i18n.ts.category }}</template>
				</MkInput>
				<MkSelect v-model="usageVisibility" class="_formBlock">
					<template #label>使用可能状態</template>
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
					<template #label>許可ユーザ ID</template>
					<template #caption>スペースまたはカンマ区切りで複数指定。下のボタンでユーザを追加できます。</template>
				</MkInput>
				<FormSplit v-if="usageVisibility === 'user'" class="_formBlock">
					<MkButton inline @click="addAllowedUser()">ユーザを追加</MkButton>
				</FormSplit>
				<FormSplit class="_formBlock">
					<span class="label">モチーフユーザー</span>
					<MkButton v-if="!motifUserId" inline @click="selectMotifUser()">ユーザを選択</MkButton>
					<template v-else>
						<MkUserName v-if="motifUser" :user="motifUser" class="_caption" />
						<span v-else class="_caption">{{ motifUserId }}</span>
						<MkButton inline @click="motifUserId = null">解除</MkButton>
					</template>
				</FormSplit>
				<MkSelect v-model="motifUserMode" class="_formBlock">
					<template #label>モチーフの利用範囲</template>
					<option value="any">誰でも使える</option>
					<option value="follow">フォロー限定</option>
					<option value="owner">そのユーザ限定</option>
				</MkSelect>
				<MkInput v-model="aliases" class="_formBlock">
					<template #label>{{ i18n.ts.tags }}</template>
					<template #caption>{{
						i18n.ts.setMultipleBySeparatingWithSpace
					}}</template>
				</MkInput>

				<FormSplit class="_formBlock">
					<MkSwitch v-model="isTextOnly">
						<template #label>{{ i18n.ts.isTextOnlyEmoji ?? "文字だけ絵文字" }}</template>
					</MkSwitch>
				</FormSplit>
				<FormSplit class="_formBlock">
					<MkSwitch v-model="sensitive">
						<template #label>{{ i18n.ts.sensitive ?? "センシティブ" }}</template>
					</MkSwitch>
				</FormSplit>

				<FormSplit class="_formBlock" style="gap: 0.5em; flex-wrap: wrap;">
					<MkButton inline @click="copyPermission = 'allow'">{{ i18n.ts._copyPermission?.allow ?? "Allow" }}</MkButton>
					<MkButton inline @click="copyPermission = 'deny'">{{ i18n.ts._copyPermission?.deny ?? "Deny" }}</MkButton>
					<MkButton inline @click="copyPermission = 'conditional'">{{ i18n.ts._copyPermission?.conditional ?? "Conditional" }}</MkButton>
				</FormSplit>
				<MkSelect
					v-model="displayCopyPermission"
					class="_formBlock"
					:disabled="isTextOnly"
				>
					<template #label>{{ i18n.ts.copyPermission }}</template>
					<option value="allow">{{ i18n.ts._copyPermission?.allow ?? "allow" }}</option>
					<option value="deny">{{ i18n.ts._copyPermission?.deny ?? "deny" }}</option>
					<option value="conditional">{{ i18n.ts._copyPermission?.conditional ?? "conditional" }}</option>
					<option value="none">{{ i18n.ts._copyPermission?.none ?? "none" }}</option>
				</MkSelect>

				<FormSplit class="_formBlock" style="gap: 0.5em; flex-wrap: wrap;">
					<MkButton inline @click="licenseName = 'CC0 1.0 Universal'" :disabled="isTextOnly">CC0</MkButton>
					<MkButton inline @click="licenseName = 'CC BY 4.0'" :disabled="isTextOnly">CC BY 4.0</MkButton>
				</FormSplit>
				<MkInput
					v-model="displayLicenseName"
					class="_formBlock"
					:disabled="isTextOnly"
				>
					<template #label>{{ i18n.ts.licenseName ?? "ライセンス名" }}</template>
				</MkInput>

				<MkInput v-model="displayCreator" class="_formBlock" :disabled="isTextOnly">
					<template #label>{{ i18n.ts.emojiAuthor }}</template>
				</MkInput>
				<MkButton inline class="_formBlock" @click="creator = instance?.host ?? ''">
					{{ i18n.ts.setCreatorToSelf ?? "製作者を自サーバーに" }}
				</MkButton>

				<MkInput v-model="usageInfo" class="_formBlock">
					<template #label>{{ i18n.ts.usageInfo }}</template>
				</MkInput>
				<MkInput v-model="description" class="_formBlock">
					<template #label>{{ i18n.ts.emojiDescription }}</template>
				</MkInput>
				<MkInput v-model="isBasedOnUrl" class="_formBlock">
					<template #label>{{ i18n.ts.isBasedOnUrl ?? "コピー元URL" }}</template>
				</MkInput>

				<MkTextarea v-model="license" class="_formBlock">
					<template #label>{{ i18n.ts.licenseSupplement ?? "ライセンス補足情報" }}</template>
				</MkTextarea>

				<MkButton danger @click="del()"
					><i class="ph-trash ph-bold ph-lg"></i>
					{{ i18n.ts.delete }}</MkButton
				>
			</div>
		</div>
	</XModalWindow>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字編集ダイアログ（管理画面）。ライセンスは個別項目＋補足情報。文字だけ絵文字時はコピー可否・ライセンス名・製作者を固定表示で無効化。
 *
 * @remarks
 * 使用可能状態（usageVisibility）・許可ユーザ（allowedUserIds）・モチーフユーザー（motifUserId）・モチーフモード（motifUserMode）の編集に対応。
 */
import { computed, ref, watch } from "vue";
import XModalWindow from "@/components/MkModalWindow.vue";
import MkButton from "@/components/MkButton.vue";
import MkInput from "@/components/form/input.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkUserName from "@/components/global/MkUserName.vue";
import FormSplit from "@/components/form/split.vue";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { emojiCategories } from "@/instance";
import { instance } from "@/instance";
import { api } from "@/os";

const props = defineProps<{
	emoji: any;
}>();

let dialog = $ref(null);
let name: string = $ref(props.emoji.name);
let category: string = $ref(
	props.emoji.category?.startsWith("!")
		? props.emoji.category.slice(1)
		: (props.emoji.category ?? "")
);
let aliases: string = $ref(
	Array.isArray(props.emoji.aliases) ? props.emoji.aliases.join(" ") : ""
);
let categories: string[] = $ref(emojiCategories);
let isTextOnly: boolean = $ref(props.emoji.isTextOnly === true);
let sensitive: boolean = $ref(props.emoji.sensitive === true);
let copyPermission: string = $ref(
	props.emoji.isTextOnly ? "allow" : (props.emoji.copyPermission ?? "none")
);
let licenseName: string = $ref(
	props.emoji.isTextOnly ? "CC0 1.0 Universal" : (props.emoji.licenseName ?? "")
);
let creator: string = $ref(props.emoji.creator ?? "");
let usageInfo: string = $ref(props.emoji.usageInfo ?? "");
let description: string = $ref(props.emoji.description ?? "");
let isBasedOnUrl: string = $ref(props.emoji.isBasedOnUrl ?? "");
let license: string = $ref(props.emoji.license ?? "");
const usageVisibility: string = $ref(
	props.emoji.usageVisibility ?? (props.emoji.category?.startsWith("!") ? "private" : "public")
);
const allowedUserIdsStr: string = $ref(
	Array.isArray(props.emoji.allowedUserIds) ? props.emoji.allowedUserIds.join(" ") : ""
);
let motifUserId: string | null = $ref(props.emoji.motifUserId ?? null);
let motifUserMode: string = $ref(props.emoji.motifUserMode ?? "any");
const motifUser = ref<any>(null);
if (props.emoji.motifUserId) {
	api("users/show", { userId: props.emoji.motifUserId })
		.then((u) => { motifUser.value = u; })
		.catch(() => { motifUser.value = null; });
}
watch(motifUserId, (id) => {
	if (!id) {
		motifUser.value = null;
		return;
	}
	api("users/show", { userId: id })
		.then((u) => { motifUser.value = u; })
		.catch(() => { motifUser.value = null; });
});

async function addAllowedUser() {
	const user = await os.selectUser();
	if (user) {
		const ids = allowedUserIdsStr.split(/[\s,]+/).filter(Boolean);
		if (!ids.includes(user.id)) {
			ids.push(user.id);
			allowedUserIdsStr = ids.join(" ");
		}
	}
}
async function selectMotifUser() {
	const user = await os.selectUser();
	if (user) {
		motifUserId = user.id;
	}
}

const displayCopyPermission = computed({
	get: () => (isTextOnly ? "allow" : copyPermission),
	set: (v: string) => {
		if (!isTextOnly) copyPermission = v;
	},
});
const displayLicenseName = computed({
	get: () => (isTextOnly ? "CC0 1.0 Universal" : licenseName),
	set: (v: string) => {
		if (!isTextOnly) licenseName = v;
	},
});
const displayCreator = computed({
	get: () => (isTextOnly ? instance?.host ?? "" : creator),
	set: (v: string) => {
		if (!isTextOnly) creator = v;
	},
});

const emit = defineEmits<{
	(ev: "done", v: { deleted?: boolean; updated?: any }): void;
	(ev: "closed"): void;
}>();

function ok() {
	update();
}

async function update() {
	await os.apiWithDialog("admin/emoji/update", {
		id: props.emoji.id,
		name,
		category: category || null,
		aliases: aliases.split(" ").filter(Boolean),
		copyPermission: copyPermission || null,
		licenseName: licenseName || null,
		creator: creator || null,
		usageInfo: usageInfo || null,
		description: description || null,
		isBasedOnUrl: isBasedOnUrl || null,
		license: license === "" ? null : license,
		isTextOnly,
		sensitive,
		usageVisibility,
		allowedUserIds:
			usageVisibility === "user"
				? allowedUserIdsStr.split(/[\s,]+/).filter(Boolean)
				: undefined,
		motifUserId: motifUserId || undefined,
		motifUserMode,
	});

	emit("done", {
		updated: {
			id: props.emoji.id,
			name,
			category,
			aliases: aliases.split(" ").filter(Boolean),
			copyPermission,
			licenseName,
			creator,
			usageInfo,
			description,
			isBasedOnUrl,
			license,
			isTextOnly,
			sensitive,
			usageVisibility,
			allowedUserIds:
				usageVisibility === "user"
					? allowedUserIdsStr.split(/[\s,]+/).filter(Boolean)
					: [],
			motifUserId,
			motifUserMode,
		},
	});

	dialog.close();
}

async function del() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.t("removeAreYouSure", { x: name }),
	});
	if (canceled) return;

	os.api("admin/emoji/delete", {
		id: props.emoji.id,
	}).then(() => {
		emit("done", {
			deleted: true,
		});
		dialog.close();
	});
}
</script>

<style lang="scss" scoped>
.yigymqpb {
	> .img {
		display: block;
		height: 4rem;
		margin: 0 auto;
	}
}
</style>
