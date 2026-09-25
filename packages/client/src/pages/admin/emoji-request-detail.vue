<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :display-back-button="true" />
		</template>
		<MkSpacer :content-max="700">
			<!-- インポート申請は、一覧と同じ部品でその 1 件だけを出す -->
			<MkAdminEmojiImportRequests v-if="kind === 'import'" :only-id="id" />

			<div v-else-if="error" :class="$style.empty">申請が見つかりませんでした。</div>
			<div v-else-if="request == null" :class="$style.empty">読み込んでいます…</div>

			<template v-else>
				<!-- #region 見出し -->
				<div :class="$style.head">
					<div :class="$style.headName">:{{ request.name }}:</div>
					<span :class="[$style.badge, $style[statusOf(request.status).tone]]">{{ statusOf(request.status).label }}</span>
					<div :class="$style.sub">
						<MkA v-if="request.requester" :to="`/@${request.requester.username}`">@{{ request.requester.username }}</MkA>
						<span v-else>申請者不明</span>
						・{{ formatRequestDate(request.createdAt) }}・{{ SOURCE_LABELS[request.source] ?? request.source }}
					</div>
				</div>

				<MkInfo v-for="w in problems" :key="w" warn :class="$style.mb12">{{ w }}</MkInfo>
				<MkInfo v-if="request.message" :class="$style.mb12">
					<div :class="$style.boxTitle">申請者からのメッセージ</div>
					<div :class="$style.pre">{{ request.message }}</div>
				</MkInfo>
				<MkInfo v-if="request.status === 'changesRequested'" :class="$style.mb12">
					<div :class="$style.boxTitle">修正のお願い中（申請者の対応待ち）</div>
					<div v-if="request.reviewComment" :class="$style.pre">{{ request.reviewComment }}</div>
					<div v-if="request.proposal && Object.keys(request.proposal).length > 0">
						提案した項目：{{ proposalLabels }}
					</div>
				</MkInfo>
				<!-- #endregion -->

				<!-- #region 審査（審査待ち・修正のお願い中のときだけ） -->
				<template v-if="editable">
					<section :class="$style.section">
						<h2 :class="$style.h">
							画像 <span v-if="changes.fileId !== undefined" :class="$style.changed">変更</span>
						</h2>
						<p v-if="request.imageProcessed" :class="$style.caption">
							申請者が加工済み（元: {{ request.originalWidth }} × {{ request.originalHeight }}）
						</p>
						<MkEmojiImageCheck
							v-if="currentFile"
							:file="currentFile"
							:original-file="editedFile ? requestFile : null"
							@processed="onProcessed"
							@restore="editedFile = null"
							@reselect="chooseFile"
						/>
						<MkButton v-else @click="chooseFile">画像を選ぶ</MkButton>
					</section>

					<section :class="$style.section">
						<h2 :class="$style.h">名前とタグ</h2>
						<MkInput v-model="form.name" class="_formBlock">
							<template #label>絵文字名 <span v-if="isChanged('name')" :class="$style.changed">変更</span></template>
							<template #prefix>:</template>
							<template #suffix>:</template>
							<template v-if="isChanged('name')" #caption>元：{{ orig("name") }}</template>
						</MkInput>
						<MkInput v-model="form.alternateName" class="_formBlock">
							<template #label>表示名 <span v-if="isChanged('alternateName')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('alternateName')" #caption>元：{{ orig("alternateName") }}</template>
						</MkInput>
						<MkInput v-model="form.ruby" class="_formBlock">
							<template #label>読み <span v-if="isChanged('ruby')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('ruby')" #caption>元：{{ orig("ruby") }}</template>
						</MkInput>
						<MkTextarea v-model="form.description" class="_formBlock">
							<template #label>説明 <span v-if="isChanged('description')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('description')" #caption>元：{{ orig("description") }}</template>
						</MkTextarea>
						<MkInput v-model="form.category" class="_formBlock" :datalist="categories">
							<template #label>カテゴリ <span v-if="isChanged('category')" :class="$style.changed">変更</span></template>
							<template #caption>
								<template v-if="isChanged('category')">元：{{ orig("category") }}<br /></template>
								<template v-if="form.category.trim()">
									{{ categoryCount > 0 ? `現在 ${categoryCount} 件の絵文字があるカテゴリです` : "まだ存在しないカテゴリです（承認すると新しく作られます）" }}
								</template>
							</template>
						</MkInput>
						<div class="_formBlock">
							<div :class="$style.label">タグ <span v-if="isChanged('aliases')" :class="$style.changed">変更</span></div>
							<MkEmojiTagInput v-model="form.aliases" />
							<div v-if="isChanged('aliases')" :class="$style.origText">元：{{ orig("aliases") }}</div>
						</div>
						<MkSwitch v-model="form.sensitive" class="_formBlock">
							<template #label>センシティブ <span v-if="isChanged('sensitive')" :class="$style.changed">変更</span></template>
						</MkSwitch>
						<MkSwitch v-model="form.isTextOnly" class="_formBlock">
							<template #label>文字だけの絵文字 <span v-if="isChanged('isTextOnly')" :class="$style.changed">変更</span></template>
							<template #caption>オンなら、承認時にライセンスは CC0・コピー可に固定されます。</template>
						</MkSwitch>
					</section>

					<section v-if="!form.isTextOnly" :class="$style.section">
						<h2 :class="$style.h">モチーフとライセンス</h2>
						<MkSelect v-model="form.motifSelf" class="_formBlock">
							<template #label>申請者がモチーフか <span v-if="isChanged('motifSelf')" :class="$style.changed">変更</span></template>
							<option value="">未回答</option>
							<option value="yes">はい</option>
							<option value="no">いいえ</option>
							<template v-if="isChanged('motifSelf')" #caption>元：{{ orig("motifSelf") }}</template>
						</MkSelect>
						<MkSelect v-if="form.motifSelf === 'yes'" v-model="form.motifUserMode" class="_formBlock">
							<template #label>使える人 <span v-if="isChanged('motifUserMode')" :class="$style.changed">変更</span></template>
							<option v-for="(label, value) in MOTIF_USER_MODE_LABELS" :key="value" :value="value">{{ label }}</option>
							<template v-if="isChanged('motifUserMode')" #caption>元：{{ orig("motifUserMode") }}</template>
						</MkSelect>
						<MkSelect v-model="form.copyPermission" class="_formBlock">
							<template #label>コピー可否 <span v-if="isChanged('copyPermission')" :class="$style.changed">変更</span></template>
							<option v-for="o in EMOJI_COPY_PERMISSION_REQUEST_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
							<template v-if="isChanged('copyPermission')" #caption>元：{{ orig("copyPermission") }}</template>
						</MkSelect>
						<MkInput v-if="form.copyPermission === COPY_PERMISSION_ASK" v-model="form.askContact" class="_formBlock">
							<template #label>許可を取る連絡先 <span v-if="isChanged('askContact')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('askContact')" #caption>元：{{ orig("askContact") }}</template>
						</MkInput>
						<MkSelect v-model="form.licenseSelect" class="_formBlock">
							<template #label>ライセンス <span v-if="isChanged('licenseName')" :class="$style.changed">変更</span></template>
							<option value="">{{ EMOJI_LICENSE_NONE_LABEL }}</option>
							<option v-for="n in EMOJI_LICENSE_NAMES" :key="n" :value="n">{{ n }}</option>
							<option :value="EMOJI_LICENSE_OTHER">{{ EMOJI_LICENSE_OTHER_LABEL }}</option>
							<template v-if="isChanged('licenseName')" #caption>元：{{ orig("licenseName") }}</template>
						</MkSelect>
						<MkInput v-if="form.licenseSelect === EMOJI_LICENSE_OTHER" v-model="form.licenseOther" class="_formBlock">
							<template #label>ライセンス名</template>
						</MkInput>
						<MkInput v-model="form.creator" class="_formBlock">
							<template #label>作者 <span v-if="isChanged('creator')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('creator')" #caption>元：{{ orig("creator") }}</template>
						</MkInput>
						<MkTextarea v-model="form.usageInfo" class="_formBlock">
							<template #label>使用情報 <span v-if="isChanged('usageInfo')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('usageInfo')" #caption>元：{{ orig("usageInfo") }}</template>
						</MkTextarea>
						<MkInput v-model="form.copyrightNotice" class="_formBlock">
							<template #label>著作権の表示 <span v-if="isChanged('copyrightNotice')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('copyrightNotice')" #caption>元：{{ orig("copyrightNotice") }}</template>
						</MkInput>
						<MkInput v-model="form.creditText" class="_formBlock">
							<template #label>クレジット <span v-if="isChanged('creditText')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('creditText')" #caption>元：{{ orig("creditText") }}</template>
						</MkInput>
						<MkTextarea v-model="form.relatedLinks" class="_formBlock">
							<template #label>関連リンク（1 行に 1 つ） <span v-if="isChanged('relatedLinks')" :class="$style.changed">変更</span></template>
							<template v-if="isChanged('relatedLinks')" #caption>元：{{ orig("relatedLinks") }}</template>
						</MkTextarea>
					</section>

					<section :class="$style.section">
						<MkTextarea v-model="comment" class="_formBlock">
							<template #label>申請者へのコメント</template>
							<template #caption>
								修正のお願い・直して承認・見送りのときに、申請者の詳細ページに表示されます。
							</template>
						</MkTextarea>
					</section>

					<div :class="$style.actions">
						<MkButton primary :disabled="working" @click="approve()">
							<i class="ph-check ph-bold"></i> {{ changedCount > 0 ? `直して承認（${changedCount} 項目）` : "承認" }}
						</MkButton>
						<MkButton
							v-if="request.status === 'pending'"
							:disabled="working || (changedCount === 0 && !comment.trim())"
							@click="requestChanges()"
						>
							<i class="ph-chat-circle-text ph-bold"></i> 修正をお願いする
						</MkButton>
						<MkButton danger :disabled="working" @click="reject()">見送る</MkButton>
					</div>
				</template>
				<!-- #endregion -->

				<!-- 処理済み -->
				<template v-else>
					<div v-if="request.file" :class="$style.doneImage">
						<img :src="request.file.url" alt="" />
					</div>
					<MkInfo v-if="request.reviewComment" :class="$style.mb12">
						<div :class="$style.boxTitle">管理者のコメント</div>
						<div :class="$style.pre">{{ request.reviewComment }}</div>
					</MkInfo>
				</template>

				<MkEmojiAddRequestSummary :request="request" viewer="reviewer" />
			</template>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 管理者向けの、絵文字申請 1 件の審査画面（`/admin/emoji-requests/{種類}/{id}`）。通知を押したときにも開く。
 *
 * @remarks
 * 追加申請（add）では、全部の項目を 1 ページに並べた入力欄で直せる（R4）。
 * - 書き換えた項目には「変更」の札と「元：〇〇」を付ける
 * - 画像の確認部品で余白カット・縮小ができる。加工した画像は管理者のドライブに上がり、承認時にサーバー側へ複製される
 * - ［承認］：何も直していなければそのまま承認、直していれば「直して承認」（直した項目を申請者に知らせる。R1）
 * - ［修正をお願いする］：直した内容を修正案として、コメントと一緒に申請者へ返す（R2）。審査待ちのときだけ
 * - ［見送る］：理由を聞いて見送る。理由の初期値は申請者へのコメント欄の内容
 * - 審査待ち・修正のお願い中でなければ、読むだけの表示にする
 * インポート申請（import）は、一覧と同じ部品でその 1 件だけを出す。
 * IDEA: 使ってみてステップ式の方がよければ直す（R4）
 *
 * @internal
 */
import { computed, onMounted, reactive, ref } from "vue";
import * as Misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkInput from "@/components/form/input.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkEmojiImageCheck from "@/components/emoji-request/MkEmojiImageCheck.vue";
import MkEmojiTagInput from "@/components/emoji-request/MkEmojiTagInput.vue";
import MkEmojiAddRequestSummary from "@/components/emoji-request/MkEmojiAddRequestSummary.vue";
import MkAdminEmojiImportRequests from "@/components/emoji-request/MkAdminEmojiImportRequests.vue";
import * as os from "@/os";
import { useRouter } from "@/router";
import { instance, emojiCategories, emojiMap } from "@/instance";
import { selectFile } from "@/scripts/select-file";
import { definePageMetadata } from "@/scripts/page-metadata";
import {
	COPY_PERMISSION_ASK,
	EMOJI_COPY_PERMISSION_REQUEST_OPTIONS,
	EMOJI_LICENSE_NAMES,
	EMOJI_LICENSE_NONE_LABEL,
	EMOJI_LICENSE_OTHER,
	EMOJI_LICENSE_OTHER_LABEL,
} from "@/scripts/emoji-license";
import {
	EMOJI_ADD_REQUEST_FIELD_LABELS,
	EMOJI_REQUEST_STATUS,
	MOTIF_USER_MODE_LABELS,
	diffRequestFields,
	formToRequestFields,
	formatEmojiAddRequestField,
	formatRequestDate,
	pickRequestFields,
	requestFieldsToForm,
	type EmojiAddRequestFields,
	type EmojiAddRequestForm,
	type PackedEmojiAddRequest,
} from "@/scripts/emoji-request";

const props = defineProps<{
	/** 申請の種類（"add" / "import"） */
	kind: string;
	id: string;
}>();

const router = useRouter();

/** 申請の出どころの表示名 */
const SOURCE_LABELS: Readonly<Record<string, string>> = {
	form: "申請画面から",
	megamoji: "MEGAMOJI から",
	legacy: "Google フォームから移行",
};

/** API のエラーの code から、管理者に見せる文 */
const ERROR_MESSAGES: Record<string, string> = {
	DUPLICATE_EMOJI_NAME: "同じ名前の絵文字が既にあります。絵文字名を直してから承認してください。",
	INVALID_NAME: "絵文字名には小文字の a-z・数字・_ だけが使えます。",
	MOTIF_REQUIRED: "「申請者がモチーフか」が未回答です。",
	USAGE_INFO_REQUIRED: "「条件付きでコピー可」のときは、使用情報が必要です。",
	NO_CHANGES: "直した項目もコメントもありません。",
	INVALID_STATUS: "この申請は既に処理されています。",
	NO_SUCH_FILE: "画像が見つかりません。",
	COPY_FAILED: "画像の取り込みに失敗しました。",
};

// #region 状態

const request = ref<PackedEmojiAddRequest | null>(null);
const error = ref(false);
const working = ref(false);
/** 開いたときの申請の項目（比べる元） */
let base: EmojiAddRequestFields | null = null;
const form = reactive<EmojiAddRequestForm>(requestFieldsToForm({ name: "", aliases: [], relatedLinks: [] } as unknown as EmojiAddRequestFields));
const comment = ref("");
/** 管理者が加工・差し替えした画像（管理者のドライブのファイル）。していなければ null */
const editedFile = ref<Misskey.entities.DriveFile | null>(null);

const editable = computed(() => request.value?.status === "pending" || request.value?.status === "changesRequested");

/** 申請の画像を、画像の確認部品に渡せる形にしたもの */
const requestFile = computed<Misskey.entities.DriveFile | null>(() => {
	const f = request.value?.file;
	if (f == null) return null;
	return {
		id: f.id,
		url: f.url,
		thumbnailUrl: f.url,
		name: `${request.value!.name}.png`,
		type: f.type,
		properties: { width: f.width ?? undefined, height: f.height ?? undefined },
	} as unknown as Misskey.entities.DriveFile;
});
const currentFile = computed(() => editedFile.value ?? requestFile.value);

// #endregion

// #region 直した内容

/** 今の入力を申請の項目にしたもの */
const after = computed(() => formToRequestFields(form, currentFile.value?.id ?? null));

/** 直した項目 */
const changes = computed<Partial<EmojiAddRequestFields>>(() => (base ? diffRequestFields(base, after.value) : {}));
const changedCount = computed(() => Object.keys(changes.value).length);

/**
 * その項目を直したか。
 *
 * @param k - 項目
 * @returns 直していれば true
 */
function isChanged(k: keyof EmojiAddRequestFields): boolean {
	return k in changes.value;
}

/**
 * 元の値を表示用の文にする。
 *
 * @param k - 項目
 * @returns 元の値（空なら「（なし）」）
 */
function orig(k: keyof EmojiAddRequestFields): string {
	if (base == null) return "";
	return formatEmojiAddRequestField(k, base[k], base) || "（なし）";
}

/** 今の修正案に入っている項目の名前 */
const proposalLabels = computed(() =>
	Object.keys(request.value?.proposal ?? {})
		.map((k) => EMOJI_ADD_REQUEST_FIELD_LABELS[k as keyof EmojiAddRequestFields])
		.join("、"),
);

/** 承認の前に気をつける点（入力に合わせて変わる） */
const problems = computed(() => {
	if (!editable.value) return [];
	const out: string[] = [];
	const name = after.value.name;
	if (!/^[a-z0-9_]+$/.test(name)) out.push("絵文字名に使えない文字があります。");
	else if (emojiMap.value.has(name)) out.push(`:${name}: という名前の絵文字が既にあります。名前を直さないと承認できません。`);
	if (!after.value.isTextOnly && after.value.motifSelf == null) out.push("「申請者がモチーフか」が未回答です。");
	return out;
});

const categories = computed(() => emojiCategories.value as string[]);
const categoryCount = computed(() => {
	const c = form.category.trim();
	return (instance.emojis ?? []).filter((e) => e.category === c).length;
});

// #endregion

// #region 画像

function onProcessed(v: { file: Misskey.entities.DriveFile }): void {
	editedFile.value = v.file;
}

/** 画像を差し替える（管理者のドライブから選ぶ） */
function chooseFile(ev: MouseEvent): void {
	selectFile(ev.currentTarget ?? ev.target, null, false, true, "emoji", { force: true }).then((file) => {
		editedFile.value = file;
	});
}

// #endregion

// #region 審査の操作

/** 送る内容（直した項目と、画像を変えたときはその画像） */
function changedParams(): Record<string, unknown> {
	return { ...changes.value };
}

/**
 * API を呼び、エラーなら分かる文で知らせる。
 *
 * @param endpoint - API
 * @param params - 送る内容
 * @returns 成功したら true
 */
async function call(endpoint: string, params: Record<string, unknown>): Promise<boolean> {
	working.value = true;
	try {
		await os.api(endpoint as any, params as any);
		return true;
	} catch (err: any) {
		os.alert({ type: "error", text: ERROR_MESSAGES[err?.code] ?? err?.message ?? "失敗しました。" });
		return false;
	} finally {
		working.value = false;
	}
}

async function approve(): Promise<void> {
	const r = request.value;
	if (r == null) return;
	const n = changedCount.value;
	const { canceled } = await os.confirm({
		type: "question",
		text: n > 0 ? `${n} 項目を直して承認しますか？\n直した項目は申請者に知らされます。` : `:${after.value.name}: を承認しますか？`,
	});
	if (canceled) return;
	if (await call("emoji-add-request/approve", { requestId: r.id, ...changedParams(), comment: comment.value.trim() || null })) {
		os.success();
		router.push("/admin/emoji-requests");
	}
}

async function requestChanges(): Promise<void> {
	const r = request.value;
	if (r == null) return;
	const { canceled } = await os.confirm({
		type: "question",
		text: "直した内容とコメントを、修正のお願いとして申請者に送りますか？",
	});
	if (canceled) return;
	if (await call("emoji-add-request/request-changes", { requestId: r.id, ...changedParams(), comment: comment.value.trim() || null })) {
		os.success();
		await load();
	}
}

async function reject(): Promise<void> {
	const r = request.value;
	if (r == null) return;
	// NOTE: 入力ダイアログは 1 行だけなので、長い理由は「申請者へのコメント」欄に書いてから押す（初期値になる）
	const { canceled, result } = await os.inputText({
		title: "見送る",
		text: "理由（任意。申請者の詳細ページに表示されます）",
		default: comment.value,
	});
	if (canceled) return;
	if (await call("emoji-add-request/reject", { requestId: r.id, reason: result?.trim() || null })) {
		os.success();
		router.push("/admin/emoji-requests");
	}
}

// #endregion

// #region 読み込み

async function load(): Promise<void> {
	try {
		const r = (await os.api("emoji-add-request/show", { requestId: props.id })) as PackedEmojiAddRequest;
		base = pickRequestFields(r);
		Object.assign(form, requestFieldsToForm(base));
		editedFile.value = null;
		comment.value = "";
		request.value = r;
	} catch {
		error.value = true;
	}
}

onMounted(() => {
	if (props.kind === "add") load();
});

// #endregion

/**
 * 状態の表示名と色を引く。
 *
 * @param status - 申請の状態
 * @returns 表示名と札の色
 */
function statusOf(status: string) {
	return EMOJI_REQUEST_STATUS[status] ?? { label: status, tone: "dim" as const };
}

definePageMetadata(
	computed(() => ({
		title: request.value ? `:${request.value.name}: の審査` : "絵文字申請の審査",
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
	margin: 0 0 12px;
}

.headName {
	font-size: 1.2em;
	font-weight: bold;
	overflow-wrap: anywhere;
}

.sub {
	margin: 4px 0 0;
	font-size: 0.85em;
	opacity: 0.8;
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

.mb12 {
	margin-bottom: 12px;
}

.boxTitle {
	font-weight: bold;
	margin: 0 0 4px;
}

.pre {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.section {
	margin: 0 0 16px;
	padding: 12px;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.h {
	margin: 0 0 12px;
	font-size: 1em;
}

.caption {
	margin: 0 0 8px;
	font-size: 0.85em;
	opacity: 0.7;
}

.label {
	margin: 0 0 8px;
	font-size: 0.85em;
}

.origText {
	margin: 8px 0 0;
	font-size: 0.85em;
	opacity: 0.7;
}

.changed {
	display: inline-block;
	margin-left: 4px;
	padding: 0 6px;
	border-radius: 6px;
	font-size: 0.75em;
	font-weight: normal;
	background: var(--accent);
	color: var(--fgOnAccent);
}

.actions {
	position: sticky;
	bottom: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0 0 16px;
	padding: 10px 0;
	background: var(--bg);
}

.doneImage {
	margin: 0 0 12px;

	> img {
		max-width: 100%;
		max-height: 128px;
		object-fit: contain;
	}
}
</style>
