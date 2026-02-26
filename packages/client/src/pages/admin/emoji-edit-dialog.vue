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
				<MkInput v-model="name" class="_formBlock">
					<template #label>{{ i18n.ts.name }}</template>
				</MkInput>
				<MkTextarea v-model="description" class="_formBlock">
					<template #label>{{ i18n.ts.emojiDescription }}</template>
				</MkTextarea>
				<MkInput
					v-model="category"
					class="_formBlock"
					:datalist="categories"
				>
					<template #label>{{ i18n.ts.category }}</template>
				</MkInput>
				<MkInput v-model="aliases" class="_formBlock">
					<template #label>{{ i18n.ts.tags }}</template>
					<template #caption>{{ i18n.ts.setMultipleBySeparatingWithSpace }}</template>
				</MkInput>
				<FormSplit class="_formBlock">
					<MkSwitch v-model="sensitive">
						<template #label>{{ i18n.ts.sensitive ?? "センシティブ" }}</template>
					</MkSwitch>
				</FormSplit>
				<hr class="form-hr" />
				<FormSplit class="_formBlock">
					<MkSwitch v-model="isTextOnly">
						<template #label>{{ i18n.ts.isTextOnlyEmoji ?? "文字だけ絵文字" }}</template>
					</MkSwitch>
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
				<div class="_formBlock">
					<MkSelect
						v-model="licenseSelectValue"
						class="_formBlock"
						:disabled="isTextOnly"
					>
						<template #label>{{ i18n.ts.licenseName ?? "ライセンス名" }}</template>
						<option value="">設定しない</option>
						<option value="CC0 1.0 Universal">CC0 1.0 Universal</option>
						<option value="CC BY 4.0">CC BY 4.0</option>
						<option value="CC BY-NC 4.0">CC BY-NC 4.0</option>
						<option value="CC BY-NC-SA 4.0">CC BY-NC-SA 4.0</option>
						<option value="CC BY-NC-ND 4.0">CC BY-NC-ND 4.0</option>
						<option value="Public Domain">Public Domain</option>
						<option value="__other__">その他</option>
					</MkSelect>
					<p class="license-caption">他の人がこの絵文字を使う・他サーバへコピーする・改変するとき、どの条件で許可するかを示します。</p>
					<div v-if="licenseSelectValue !== '' && !isTextOnly" class="license-description">
						{{ licenseDescription }}
					</div>
					<MkInput
						v-if="licenseSelectValue === '__other__' && !isTextOnly"
						v-model="licenseNameOther"
						class="_formBlock"
					>
						<template #label>ライセンス名（その他）</template>
					</MkInput>
				</div>
				<MkInput v-model="displayCreator" class="_formBlock" :disabled="isTextOnly">
					<template #label>{{ i18n.ts.emojiAuthor }}</template>
				</MkInput>
				<MkTextarea v-model="usageInfo" class="_formBlock">
					<template #label>{{ i18n.ts.usageInfo }}</template>
				</MkTextarea>
				<MkInput v-model="isBasedOnUrl" class="_formBlock">
					<template #label>{{ i18n.ts.isBasedOnUrl ?? "コピー元URL" }}</template>
				</MkInput>
				<MkTextarea v-model="license" class="_formBlock">
					<template #label>{{ i18n.ts.licenseSupplement ?? "ライセンス補足情報" }}</template>
				</MkTextarea>
				<FormSplit class="_formBlock">
					<span class="label">モチーフユーザー</span>
					<div class="motif-user__body">
						<MkInput v-model="motifUserId" class="_formBlock">
							<template #label>モチーフユーザー ID</template>
							<template #caption>
								ローカルユーザの ID を直接指定できます。下のボタンからユーザを選択することもできます。
							</template>
						</MkInput>
						<div class="motif-user__actions">
							<MkButton inline @click="selectMotifUser()">ユーザを選択</MkButton>
							<MkButton v-if="motifUserId" inline @click="motifUserId = null">解除</MkButton>
						</div>
						<MkUserName v-if="motifUser" :user="motifUser" class="_caption" />
						<span v-else-if="motifUserId" class="_caption">{{ motifUserId }}</span>
					</div>
				</FormSplit>
				<MkSelect v-model="motifUserMode" class="_formBlock">
					<template #label>モチーフの利用範囲</template>
					<option value="any">誰でも使える</option>
					<option value="follow">フォロー限定</option>
					<option value="owner">そのユーザ限定</option>
				</MkSelect>
				<hr class="form-hr" />
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
 * 絵文字編集ダイアログ（管理画面）。項目順・ライセンスリスト選択・文字だけ時の製作者自サーバ自動設定に対応。
 *
 * @remarks
 * 使用可能状態・許可ユーザ・モチーフユーザー・モチーフモードの編集、ライセンス名のリスト選択と説明表示に対応。
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

const LICENSE_DESCRIPTIONS: Record<string, string> = {
	"": "この絵文字について、ライセンスを指定しません。二次創作物などでライセンス不明の場合は「設定しない」にしておく運用を推奨します。",
	"CC0 1.0 Universal":
		"作者が全ての権利を行使しないと宣言した状態です。作者の意思で「自由に使ってよい」と明示します。クレジット表示なしで商用・改変ともに自由に使えます。",
	"CC BY 4.0":
		"この絵文字を使用・コピーする際、作者のクレジット表示を条件とします。商用利用も改変も可能です。",
	"CC BY-NC 4.0":
		"この絵文字を使用・コピーする際、作者のクレジット表示が必要で、かつ商用利用は出来ないようにします。改変・二次創作は可能です。",
	"CC BY-NC-SA 4.0":
		"この絵文字を使用・コピーする際、作者のクレジット表示が必要で、かつ商用利用は出来ないようにします。改変・二次創作は可能ですが、改変した作品も CC BY-NC-SA で公開する必要があります。",
	"CC BY-NC-ND 4.0":
		"この絵文字を使用・コピーする際、クレジット表示が必要で、商用利用も改変もできません。そのままの形で使う（表示・配布）事のみ許可するライセンスです。",
	"Public Domain":
		"法律で著作権が切れた、または最初から権利が及ばない状態です。クレジット表示なしで商用・改変ともに自由に使えます。",
	"__other__": "上記以外のライセンスを使う場合に選び、下の入力欄にライセンス名を記入してください。",
};

const KNOWN_LICENSE_VALUES = [
	"",
	"CC0 1.0 Universal",
	"CC BY 4.0",
	"CC BY-NC 4.0",
	"CC BY-NC-SA 4.0",
	"CC BY-NC-ND 4.0",
	"Public Domain",
];

function resolveLicenseSelectValue(name: string | null | undefined): string {
	if (name == null || name === "") return "";
	return KNOWN_LICENSE_VALUES.includes(name) ? name : "__other__";
}

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
let creator: string = $ref(
	props.emoji.isTextOnly
		? (instance?.host ?? "")
		: (props.emoji.creator ?? "")
);
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
let licenseSelectValue: string = $ref(
	resolveLicenseSelectValue(props.emoji.isTextOnly ? "CC0 1.0 Universal" : props.emoji.licenseName)
);
let licenseNameOther: string = $ref(
	resolveLicenseSelectValue(props.emoji.licenseName) === "__other__" ? (props.emoji.licenseName ?? "") : ""
);

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

watch(isTextOnly, (v) => {
	if (v) creator = instance?.host ?? "";
}, { immediate: true });

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
	const user = await os.selectUser({ localOnly: true, includeSelf: true });
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

const effectiveLicenseName = computed(() => {
	if (isTextOnly) return "CC0 1.0 Universal";
	if (licenseSelectValue === "__other__") return licenseNameOther;
	return licenseSelectValue;
});

const licenseDescription = computed(() => {
	if (isTextOnly) return LICENSE_DESCRIPTIONS["CC0 1.0 Universal"];
	return LICENSE_DESCRIPTIONS[licenseSelectValue] ?? "";
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
		licenseName: effectiveLicenseName || null,
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
			licenseName: effectiveLicenseName || null,
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

.form-hr {
	margin: 1rem 0;
	border: none;
	border-top: 1px solid var(--divider);
}

.license-caption {
	margin: 0 0 0.5rem;
	font-size: 0.85em;
	opacity: 0.8;
}

.license-description {
	margin-bottom: 0.5rem;
	padding: 0.5rem;
	font-size: 0.9em;
	background: var(--panel);
	border-radius: 6px;
	white-space: pre-wrap;
}

.motif-user__body {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	width: 100%;
}

.motif-user__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}
</style>
