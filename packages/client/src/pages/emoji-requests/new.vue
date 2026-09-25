<template>
	<MkStickyContainer>
		<template #header>
			<MkPageHeader :display-back-button="true" />
		</template>
		<MkSpacer :content-max="600">
			<div ref="rootEl" :class="$style.root">
				<!-- #region 送信後 -->
				<div v-if="submittedId" :class="$style.done">
					<i class="ph-check-circle ph-bold" :class="$style.doneIcon"></i>
					<div :class="$style.doneTitle">申請しました</div>
					<p :class="$style.caption">
						管理者が確認します。<br />結果は通知でお知らせします。
					</p>
					<MkButton primary full @click="router.push('/emoji-requests')">申請の一覧へ</MkButton>
					<MkButton full :class="$style.mt8" @click="restart()">続けて申請する</MkButton>
				</div>
				<!-- #endregion -->

				<template v-else>
					<!-- 進み具合 -->
					<div :class="$style.progress">
						<div :class="$style.bars">
							<span
								v-for="(s, i) in steps"
								:key="s"
								:class="[$style.bar, { [$style.barDone]: i <= stepIndex }]"
							></span>
						</div>
						<div :class="$style.progressText">
							{{ stepIndex + 1 }} / {{ steps.length }}　{{ STEP_LABELS[step] }}
						</div>
					</div>

					<MkInfo v-if="restoredDraft && step === 'image'" :class="$style.mb12">
						前回の入力の続きから始めます。
						<button class="_textButton" @click="restart()">最初からやり直す</button>
					</MkInfo>

					<!-- #region 1. 画像 -->
					<section v-if="step === 'image'">
						<h2 :class="$style.h">絵文字の画像</h2>
						<div v-if="uploading" :class="$style.dim">画像を受け取っています…</div>
						<MkEmojiImageCheck
							v-else-if="d.file"
							:file="d.file"
							:original-file="d.originalFile"
							@processed="onProcessed"
							@restore="onRestore"
							@reselect="chooseFile"
						/>
						<template v-else>
							<MkButton primary full large @click="chooseFile">
								<i class="ph-upload-simple ph-bold"></i> 画像を選ぶ
							</MkButton>
							<p :class="$style.caption">
								縦 256px 程度・四隅の余白は削るのがおすすめ。<br />ダーク・ライトの両方で見やすいか確認してください。
							</p>
						</template>
					</section>
					<!-- #endregion -->

					<!-- #region 2. 名前とタグ -->
					<section v-else-if="step === 'name'">
						<h2 :class="$style.h">名前とタグ</h2>
						<MkInput v-model="d.name" class="_formBlock" :class="$style.mono">
							<template #label>絵文字名 <span :class="[$style.req, $style.required]">必須</span></template>
							<template #prefix>:</template>
							<template #suffix>:</template>
							<template #caption>
								<span v-if="d.name && !nameValid" :class="$style.errorText">
									小文字の a-z・数字・_（アンダーバー）だけが使えます。
								</span>
								<span v-else-if="nameExists" :class="$style.warnText">
									同じ名前の絵文字がすでにあります。<br />このまま申請できますが、承認のときに名前を変えることがあります。
								</span>
								<template v-else>小文字の a-z・数字・_（アンダーバー）で入力します。</template>
							</template>
						</MkInput>
						<MkInput v-model="d.alternateName" class="_formBlock">
							<template #label>表示名 <span :class="$style.req">任意</span></template>
							<template #caption>絵文字名を日本語などで書いたもの。</template>
						</MkInput>
						<MkInput v-model="d.ruby" class="_formBlock">
							<template #label>読み <span :class="$style.req">任意</span></template>
							<template #caption>ひらがなで書いた読み方。<br />絵文字の検索にも使われます</template>
						</MkInput>
						<MkTextarea v-model="d.description" class="_formBlock">
							<template #label>説明 <span :class="$style.req">任意</span></template>
						</MkTextarea>
						<MkInput v-model="d.category" class="_formBlock" :datalist="categories">
							<template #label>カテゴリ <span :class="$style.req">任意</span></template>
							<template v-if="d.category.trim()" #caption>
								<template v-if="categoryCount > 0">現在 {{ categoryCount }} 件の絵文字があるカテゴリです</template>
								<template v-else>そのカテゴリはまだ存在しません。<br />新規作成する予定です。</template>
							</template>
						</MkInput>
						<MkInput v-model="d.aliases" class="_formBlock">
							<template #label>タグ <span :class="$style.req">任意</span></template>
							<template #caption>絵文字の別名になります。<br />空白で区切って複数入力できます。</template>
						</MkInput>
						<MkSwitch v-model="d.sensitive" class="_formBlock">
							<template #label>センシティブ</template>
							<template #caption>公開投稿で使えないような場合</template>
						</MkSwitch>
					</section>
					<!-- #endregion -->

					<!-- #region 3. ライセンス情報を入力するか -->
					<section v-else-if="step === 'licenseQ'">
						<h2 :class="$style.h">ライセンス情報を入力しますか？</h2>
						<div :class="$style.choices">
							<button
								class="_button"
								:class="[$style.choice, { [$style.choiceOn]: d.licenseMode === 'input' }]"
								@click="d.licenseMode = 'input'"
							>
								<div :class="$style.choiceTitle">入力する</div>
								<div :class="$style.caption">絵や写真などの絵文字</div>
							</button>
							<button
								class="_button"
								:class="[$style.choice, { [$style.choiceOn]: d.licenseMode === 'textOnly' }]"
								@click="d.licenseMode = 'textOnly'"
							>
								<div :class="$style.choiceTitle">文字だけの絵文字なので不要（PD）</div>
								<div :class="$style.caption">文字だけの絵文字は、誰でも自由に使えるもの（パブリックドメイン）として扱います。</div>
							</button>
						</div>
					</section>
					<!-- #endregion -->

					<!-- #region 4. モチーフ -->
					<section v-else-if="step === 'motif'">
						<h2 :class="$style.h">この絵文字は、あなた自身がモチーフですか？ <span :class="[$style.req, $style.required]">必須</span></h2>
						<div :class="$style.choices">
							<button
								class="_button"
								:class="[$style.choice, { [$style.choiceOn]: d.motifSelf === true }]"
								@click="d.motifSelf = true"
							>
								<div :class="$style.choiceTitle">はい</div>
							</button>
							<button
								class="_button"
								:class="[$style.choice, { [$style.choiceOn]: d.motifSelf === false }]"
								@click="d.motifSelf = false"
							>
								<div :class="$style.choiceTitle">いいえ</div>
							</button>
						</div>
						<template v-if="d.motifSelf === true">
							<div :class="$style.subHead">この絵文字を使える人</div>
							<div :class="$style.choices">
								<button
									v-for="m in MOTIF_MODES"
									:key="m.value"
									class="_button"
									:class="[$style.choice, { [$style.choiceOn]: d.motifUserMode === m.value }]"
									@click="d.motifUserMode = m.value"
								>
									<div :class="$style.choiceTitle">{{ m.label }}</div>
									<div v-if="m.caption" :class="$style.caption">{{ m.caption }}</div>
								</button>
							</div>
						</template>
					</section>
					<!-- #endregion -->

					<!-- #region 5. ライセンス情報 -->
					<section v-else-if="step === 'license'">
						<h2 :class="$style.h">ライセンス情報</h2>
						<MkButton full :class="$style.mb12" @click="openPresetSheet">
							<i class="ph-hand-pointing ph-bold"></i> どう使ってほしいかで選ぶ
						</MkButton>

						<MkSelect v-model="d.copyPermission" class="_formBlock">
							<template #label>コピー可否</template>
							<option v-for="o in EMOJI_COPY_PERMISSION_REQUEST_OPTIONS" :key="o.value" :value="o.value">
								{{ o.label }}
							</option>
						</MkSelect>

						<MkSelect v-model="d.licenseSelect" class="_formBlock">
							<template #label>ライセンス</template>
							<option value="">{{ EMOJI_LICENSE_NONE_LABEL }}</option>
							<option v-for="n in EMOJI_LICENSE_NAMES" :key="n" :value="n">{{ n }}</option>
							<option :value="EMOJI_LICENSE_OTHER">{{ EMOJI_LICENSE_OTHER_LABEL }}</option>
							<template #caption>
								<span :class="$style.pre">{{ EMOJI_LICENSE_SHORT_DESCRIPTIONS[d.licenseSelect] }}</span>
							</template>
						</MkSelect>
						<MkInput
							v-if="d.licenseSelect === EMOJI_LICENSE_OTHER"
							v-model="d.licenseOther"
							class="_formBlock"
						>
							<template #label>ライセンス名 <span :class="[$style.req, $style.required]">必須</span></template>
							<template #caption>例：Apache License 2.0</template>
						</MkInput>

						<MkInput v-model="d.creator" class="_formBlock">
							<template #label>作者 <span :class="$style.req">任意</span></template>
							<template #suffix>
								<button class="_textButton" @click="d.creator = selfId">自分</button>
							</template>
							<template #caption>この絵文字を描いた（作った）人です。<br />fediverse 上の ID であることが望ましいです。</template>
						</MkInput>

						<MkInput v-if="isAsk" v-model="d.askContact" class="_formBlock">
							<template #label>許可を取る連絡先 <span :class="[$style.req, $style.required]">必須</span></template>
							<template #suffix>
								<button class="_textButton" @click="d.askContact = selfId">自分</button>
							</template>
							<template #caption>コピーしたい人が、許可を取るための連絡先です。</template>
						</MkInput>
						<MkTextarea v-if="showUsageInfo" v-model="d.usageInfo" class="_formBlock">
							<template #label>
								使用情報
								<span v-if="usageInfoRequired" :class="[$style.req, $style.required]">必須</span>
								<span v-else :class="$style.req">任意</span>
							</template>
							<template #caption>絵文字をインポートする際の注意など。<br />「条件付きでコピー可」のときは、条件をここに書きます。</template>
						</MkTextarea>

						<!-- 詳細情報（どれも任意） -->
						<button class="_button" :class="$style.foldHead" @click="showDetails = !showDetails">
							<span>詳細情報</span>
							<i :class="showDetails ? 'ph-caret-up ph-bold' : 'ph-caret-down ph-bold'"></i>
						</button>
						<div v-if="showDetails" :class="$style.fold">
							<p :class="$style.caption">設定しなくても申請に問題はありませんが、<br />設定可能な項目です。</p>
							<MkInput v-model="d.copyrightNotice" class="_formBlock">
								<template #label>著作権の表示</template>
								<template #caption>作者とは別に、元作品の権利者などを示したいときに書きます。<br />例「© 〇〇株式会社」</template>
							</MkInput>
							<MkInput v-model="d.creditText" class="_formBlock">
								<template #label>クレジット</template>
								<template #caption>作成に使ったソフトやフォントなど。<br />例「〇〇フォントを使用」「Adobe Illustrator で作成」「Generated using MEGAMOJI」</template>
							</MkInput>
							<MkTextarea v-model="d.relatedLinks" class="_formBlock">
								<template #label>関連リンク</template>
								<template #caption>1 行に 1 つずつ入力します。<br />例：絵文字の配布ページ、利用規約のページ、使ったフォントのページ</template>
							</MkTextarea>
						</div>
					</section>
					<!-- #endregion -->

					<!-- #region 6. 確認 -->
					<section v-else-if="step === 'confirm'">
						<h2 :class="$style.h">申請内容の確認</h2>
						<div v-if="d.file" :class="$style.confirmImage">
							<img :src="d.file.url" alt="" />
							<button class="_textButton" @click="goTo('image')">変更</button>
						</div>

						<div :class="$style.section">
							<div :class="$style.sectionHead">
								<span>名前とタグ</span>
								<button class="_textButton" @click="goTo('name')">変更</button>
							</div>
							<template v-for="row in nameRows" :key="row.label">
								<div :class="$style.row">
									<span :class="$style.rowLabel">{{ row.label }}</span>
									<span :class="$style.rowValue">{{ row.value }}</span>
								</div>
							</template>
						</div>

						<div :class="$style.section">
							<div :class="$style.sectionHead">
								<span>ライセンス</span>
								<button v-if="!megamojiSimple" class="_textButton" @click="goTo('licenseQ')">変更</button>
							</div>
							<template v-if="isTextOnly">
								<div :class="$style.row">
									<span :class="$style.rowLabel">ライセンス</span>
									<span :class="$style.rowValue">文字だけの絵文字（PD）</span>
								</div>
								<button v-if="megamojiSimple" class="_textButton" :class="$style.smallLink" @click="leaveMegamojiSimple()">
									文字だけの絵文字ではない場合
								</button>
							</template>
							<template v-for="row in licenseRows" v-else :key="row.label">
								<div :class="$style.row">
									<span :class="$style.rowLabel">{{ row.label }}</span>
									<span :class="$style.rowValue">{{ row.value }}</span>
								</div>
							</template>
						</div>

						<MkTextarea v-model="d.message" class="_formBlock" placeholder="特に何もなければ空欄で結構です">
							<template #label><span :class="$style.messageLabel">申請にあたって、承認者へ伝える必要があるメッセージ</span></template>
						</MkTextarea>
					</section>
					<!-- #endregion -->

					<!-- 進む・戻る -->
					<div :class="$style.nav">
						<MkButton v-if="stepIndex > 0" :class="$style.navButton" @click="back()">
							<i class="ph-caret-left ph-bold"></i> 戻る
						</MkButton>
						<MkButton
							v-if="step !== 'confirm'"
							primary
							:class="$style.navButton"
							:disabled="!canProceed"
							@click="next()"
						>
							次へ <i class="ph-caret-right ph-bold"></i>
						</MkButton>
						<MkButton
							v-else
							primary
							:class="$style.navButton"
							:disabled="submitting || !d.file || !nameValid"
							@click="submit()"
						>
							<i class="ph-paper-plane-tilt ph-bold"></i> 申請する
						</MkButton>
					</div>
				</template>
			</div>
		</MkSpacer>
	</MkStickyContainer>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字の追加申請ページ（`/emoji-requests/new`）。1 つの絵文字を、ステップ式で申請する。
 *
 * @remarks
 * Google フォームの流れを引き継ぎ、スマホで 1 画面に 1 つのテーマだけを置く（計画書「申請画面の案」）。
 * 1. 画像 → 2. 名前とタグ → 3. ライセンス情報を入力するか → 4. モチーフ → 5. ライセンス情報 → 6. 確認
 * - 3 で「文字だけの絵文字なので不要（PD）」なら 4 と 5 を飛ばす
 * - MEGAMOJI から来たとき（`?from=megamoji`）は文字だけの絵文字として「画像 → 名前とタグ → 確認」の 3 ステップにする（H4）。
 *   確認画面の「文字だけの絵文字ではない場合」で 3 から始まるふつうの流れに戻す（H5）
 * - MEGAMOJI が `window.open` でこのページを開いたときは、準備ができたら opener へ知らせ、`postMessage` で画像を受け取る（H1）。
 *   受け付けるのは {@link MEGAMOJI_ORIGIN} からの画像のデータだけ。受け取っても自動では申請しない
 * - 入力の途中は localStorage に下書きとして残し、次に開いたときに続きから始める（MEGAMOJI から来たときは使わない）
 * - 「許可の後、コピー可」は画面だけの選択肢。送るときは連絡先（askContact）を付け、サーバー側で conditional と前置きの文に変える（B5）
 * TODO: 修正のお願いへの対応（R2：管理者の提案を入力欄の下に出す）は、手順 7 でこのページを元の申請内容から開けるようにして入れる
 *
 * @internal
 */
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import * as Misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkInput from "@/components/form/input.vue";
import MkTextarea from "@/components/form/textarea.vue";
import MkSelect from "@/components/form/select.vue";
import MkSwitch from "@/components/form/switch.vue";
import MkEmojiImageCheck from "@/components/emoji-request/MkEmojiImageCheck.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { host } from "@/config";
import { useRouter } from "@/router";
import { defaultStore } from "@/store";
import { instance, emojiCategories, emojiMap } from "@/instance";
import { selectFile } from "@/scripts/select-file";
import { uploadFile } from "@/scripts/upload";
import { definePageMetadata } from "@/scripts/page-metadata";
import {
	COPY_PERMISSION_ASK,
	EMOJI_COPY_PERMISSION_REQUEST_OPTIONS,
	EMOJI_LICENSE_NAMES,
	EMOJI_LICENSE_NONE_LABEL,
	EMOJI_LICENSE_OTHER,
	EMOJI_LICENSE_OTHER_LABEL,
	EMOJI_LICENSE_SHORT_DESCRIPTIONS,
	MKCK_USAGE_INFO,
	resolveLicenseSelectValue,
	type EmojiLicensePreset,
} from "@/scripts/emoji-license";

const props = defineProps<{
	/** 絵文字名の初期値（MEGAMOJI などから URL で渡す） */
	name?: string;
	/** "megamoji" なら MEGAMOJI から来た */
	from?: string;
}>();

const router = useRouter();

// #region 定数

/** MEGAMOJI の送り元。これ以外からの postMessage は受け取らない */
const MEGAMOJI_ORIGIN = "https://emtkmkk.github.io";

/** 下書きを置く localStorage のキー */
const DRAFT_KEY = "emojiAddRequestDraft";

/** 画面の種類 */
type Step = "image" | "name" | "licenseQ" | "motif" | "license" | "confirm";

const STEP_LABELS: Record<Step, string> = {
	image: "画像",
	name: "名前とタグ",
	licenseQ: "ライセンス",
	motif: "モチーフ",
	license: "ライセンス情報",
	confirm: "確認",
};

/** モチーフが自分のときの、使える人の選択肢（motifUserMode） */
const MOTIF_MODES = [
	{ value: "any", label: "誰でも使える", caption: "" },
	{ value: "follow", label: "フォロー限定", caption: "あなたをフォローしている人が使えます。" },
	{ value: "owner", label: "自分限定", caption: "あなただけが使えます。" },
] as const;

// #endregion

// #region 入力の状態

/** 入力の中身（下書きとしてそのまま保存する） */
type Draft = {
	file: Misskey.entities.DriveFile | null;
	/** 余白カット・縮小をする前の画像（加工していなければ null） */
	originalFile: Misskey.entities.DriveFile | null;
	originalSize: { width: number; height: number } | null;
	name: string;
	alternateName: string;
	ruby: string;
	description: string;
	category: string;
	aliases: string;
	sensitive: boolean;
	/** 3 の答え。未回答は null */
	licenseMode: "input" | "textOnly" | null;
	motifSelf: boolean | null;
	motifUserMode: "any" | "follow" | "owner";
	/** コピー可否（画面の選択肢。"ask" は「許可の後、コピー可」） */
	copyPermission: string;
	licenseSelect: string;
	licenseOther: string;
	creator: string;
	askContact: string;
	usageInfo: string;
	copyrightNotice: string;
	creditText: string;
	relatedLinks: string;
	message: string;
	/** ［どう使ってほしいかで選ぶ］で最後に選んだカード */
	presetKey: string | null;
	presetAsk: boolean;
};

/**
 * 空の入力を作る。
 *
 * @returns 初期状態
 */
function emptyDraft(): Draft {
	return {
		file: null,
		originalFile: null,
		originalSize: null,
		name: "",
		alternateName: "",
		ruby: "",
		description: "",
		category: "",
		aliases: "",
		sensitive: false,
		licenseMode: null,
		motifSelf: null,
		motifUserMode: "any",
		copyPermission: "none",
		licenseSelect: "",
		licenseOther: "",
		creator: "",
		askContact: "",
		usageInfo: "",
		copyrightNotice: "",
		creditText: "",
		relatedLinks: "",
		message: "",
		presetKey: null,
		presetAsk: false,
	};
}

const d = reactive<Draft>(emptyDraft());
const step = ref<Step>("image");
/** MEGAMOJI から来て、3 ステップの流れにしているか */
const megamojiSimple = ref(false);
const restoredDraft = ref(false);
const uploading = ref(false);
const submitting = ref(false);
const submittedId = ref<string | null>(null);
const showDetails = ref(false);
const rootEl = ref<HTMLElement>();

// #endregion

// #region 画面の流れ

const isTextOnly = computed(() => megamojiSimple.value || d.licenseMode === "textOnly");

/** 今の入力で通る画面の一覧 */
const steps = computed<Step[]>(() => {
	if (megamojiSimple.value) return ["image", "name", "confirm"];
	if (d.licenseMode === "textOnly") return ["image", "name", "licenseQ", "confirm"];
	return ["image", "name", "licenseQ", "motif", "license", "confirm"];
});
const stepIndex = computed(() => Math.max(0, steps.value.indexOf(step.value)));

/** 今の画面で「次へ」を押せるか */
const canProceed = computed(() => {
	switch (step.value) {
		case "image":
			return d.file != null && !uploading.value;
		case "name":
			return nameValid.value;
		case "licenseQ":
			return d.licenseMode != null;
		case "motif":
			return d.motifSelf != null;
		case "license":
			if (isAsk.value && !d.askContact.trim()) return false;
			if (usageInfoRequired.value && !d.usageInfo.trim()) return false;
			if (d.licenseSelect === EMOJI_LICENSE_OTHER && !d.licenseOther.trim()) return false;
			return true;
		default:
			return true;
	}
});

/**
 * 画面を移る。移ったら画面の先頭へ戻す（スマホで下のほうに居たままにならないように）。
 *
 * @param s - 移る先
 */
function goTo(s: Step): void {
	step.value = s;
	rootEl.value?.scrollIntoView({ block: "start" });
}

function next(): void {
	const i = stepIndex.value;
	if (i < steps.value.length - 1) goTo(steps.value[i + 1]);
}

function back(): void {
	const i = stepIndex.value;
	if (i > 0) goTo(steps.value[i - 1]);
}

/** MEGAMOJI の 3 ステップをやめて、「ライセンス情報を入力しますか？」からのふつうの流れに戻す（H5） */
function leaveMegamojiSimple(): void {
	megamojiSimple.value = false;
	d.licenseMode = null;
	goTo("licenseQ");
}

// #endregion

// #region 画像

/**
 * ファイル名から絵文字名の候補を作る（使えない文字は _ にする）。
 *
 * @param fileName - ファイル名
 * @returns 絵文字名の候補（作れなければ空文字）
 */
function nameFromFileName(fileName: string): string {
	return fileName
		.replace(/\.\w+$/, "")
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

/**
 * 新しい画像を使う（加工前の情報は消す）。
 *
 * @param file - 選んだ画像
 */
function setFile(file: Misskey.entities.DriveFile): void {
	d.file = file;
	d.originalFile = null;
	d.originalSize = null;
	if (!d.name) d.name = nameFromFileName(file.name);
}

/**
 * 画像を選ぶ。
 *
 * @param ev - 押したボタンのイベント（選び方のメニューの位置に使う）
 */
function chooseFile(ev: MouseEvent): void {
	selectFile(ev.currentTarget ?? ev.target, null, false, true, "emoji", { force: true }).then((file) => {
		if (!file.type.startsWith("image/")) {
			os.alert({ type: "error", text: "画像のファイルを選んでください。" });
			return;
		}
		setFile(file);
	});
}

/** 余白カット・縮小をした（最初の画像は元として残す） */
function onProcessed(v: { file: Misskey.entities.DriveFile; original: { width: number; height: number } }): void {
	if (d.originalFile == null) d.originalFile = d.file;
	d.originalSize = v.original;
	d.file = v.file;
}

/** 加工をやめて元の画像に戻す */
function onRestore(): void {
	if (d.originalFile == null) return;
	d.file = d.originalFile;
	d.originalFile = null;
	d.originalSize = null;
}

// #endregion

// #region 名前とタグ

const nameValid = computed(() => /^[a-z0-9_]+$/.test(d.name.trim().toLowerCase()) && d.name.trim().length <= 128);
const nameExists = computed(() => emojiMap.value.has(d.name.trim().toLowerCase()));
const categories = computed(() => emojiCategories.value as string[]);
const categoryCount = computed(() => {
	const c = d.category.trim();
	return (instance.emojis ?? []).filter((e) => e.category === c).length;
});

// #endregion

// #region ライセンス情報

/** 作者・連絡先の［自分］で入れる ID */
const selfId = $i ? `@${$i.username}@${host}` : "";

const isAsk = computed(() => d.copyPermission === COPY_PERMISSION_ASK);

/**
 * 使用情報の欄を出すか。
 *
 * @remarks
 * 「許可の後、コピー可」のときは連絡先の欄に置き換わる（フォームと同じ）。
 * 例外として、もこチキのカード＋「一声かけてほしい」のときだけは連絡先と両方を出す（B5）。
 */
const showUsageInfo = computed(() => !isAsk.value || (d.presetKey === "mkck" && d.presetAsk));
const usageInfoRequired = computed(() => d.copyPermission === "conditional");

/** ［どう使ってほしいかで選ぶ］のパネルを開く */
function openPresetSheet(): void {
	os.popup(
		defineAsyncComponent(() => import("@/components/emoji-request/MkEmojiLicensePresetSheet.vue")),
		{ initialKey: d.presetKey, initialAsk: d.presetAsk },
		{
			done: (v: { preset: EmojiLicensePreset; ask: boolean }) => applyPreset(v.preset, v.ask),
		},
		"closed",
	);
}

/**
 * カードの内容を入れる（入れた後は手で変えられる）。
 *
 * @param preset - 選んだカード
 * @param ask - 「一声かけてほしい」
 */
function applyPreset(preset: EmojiLicensePreset, ask: boolean): void {
	d.presetKey = preset.key;
	d.presetAsk = ask;
	d.copyPermission = ask ? COPY_PERMISSION_ASK : preset.copyPermission;
	d.licenseSelect = resolveLicenseSelectValue(preset.licenseName);
	d.licenseOther = d.licenseSelect === EMOJI_LICENSE_OTHER ? preset.licenseName : "";
	if (preset.usageInfo) {
		d.usageInfo = preset.usageInfo;
	} else if (d.usageInfo === MKCK_USAGE_INFO) {
		// 前にもこチキのカードで入った文は、別のカードに変えたら消す（自分で書いた文は残す）
		d.usageInfo = "";
	}
	if (ask && !d.askContact) d.askContact = selfId;
}

// #endregion

// #region 確認画面

/** コピー可否の値から表示名を引く */
function copyPermissionLabel(v: string): string {
	return EMOJI_COPY_PERMISSION_REQUEST_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

/** 送るライセンス名（付けないなら null） */
const licenseName = computed(() => {
	if (d.licenseSelect === EMOJI_LICENSE_OTHER) return d.licenseOther.trim() || null;
	return d.licenseSelect || null;
});

/** 1 行 1 つの関連リンク */
const relatedLinkList = computed(() => d.relatedLinks.split(/\r?\n/).map((x) => x.trim()).filter(Boolean));

/**
 * 空の行を除いて並べる。
 *
 * @param rows - 見出しと値
 * @returns 値のある行だけ
 */
function filled(rows: { label: string; value: string | null | undefined }[]): { label: string; value: string }[] {
	return rows.filter((r): r is { label: string; value: string } => r.value != null && r.value.trim() !== "");
}

const nameRows = computed(() =>
	filled([
		{ label: "絵文字名", value: `:${d.name.trim().toLowerCase()}:` },
		{ label: "表示名", value: d.alternateName },
		{ label: "読み", value: d.ruby },
		{ label: "説明", value: d.description },
		{ label: "カテゴリ", value: d.category },
		{ label: "タグ", value: d.aliases.split(/[\s　]+/).filter(Boolean).join("、") },
		{ label: "センシティブ", value: d.sensitive ? "はい" : null },
	]),
);

const licenseRows = computed(() =>
	filled([
		{ label: "自分がモチーフ", value: d.motifSelf == null ? null : d.motifSelf ? "はい" : "いいえ" },
		{
			label: "使える人",
			value: d.motifSelf ? MOTIF_MODES.find((m) => m.value === d.motifUserMode)?.label : null,
		},
		{ label: "コピー可否", value: copyPermissionLabel(d.copyPermission) },
		{ label: "ライセンス", value: licenseName.value ?? EMOJI_LICENSE_NONE_LABEL },
		{ label: "作者", value: d.creator },
		{ label: "許可を取る連絡先", value: isAsk.value ? d.askContact : null },
		{ label: "使用情報", value: showUsageInfo.value ? d.usageInfo : null },
		{ label: "著作権の表示", value: d.copyrightNotice },
		{ label: "クレジット", value: d.creditText },
		{ label: "関連リンク", value: relatedLinkList.value.join("\n") },
	]),
);

// #endregion

// #region 送信

/** API のエラーの code から、利用者に見せる文 */
const ERROR_MESSAGES: Record<string, string> = {
	NO_SUCH_FILE: "画像が見つかりませんでした。選び直してください。",
	NOT_IMAGE: "画像のファイルを選んでください。",
	COPY_FAILED: "画像の取り込みに失敗しました。時間をおいて試してください。",
	INVALID_NAME: "絵文字名には小文字の a-z・数字・_ だけが使えます。",
	MOTIF_REQUIRED: "「あなた自身がモチーフか」を選んでください。",
	USAGE_INFO_REQUIRED: "「条件付きでコピー可」のときは、使用情報に条件を書いてください。",
};

async function submit(): Promise<void> {
	if (d.file == null || submitting.value) return;
	submitting.value = true;
	const textOnly = isTextOnly.value;
	const text = (v: string) => v.trim() || null;
	try {
		const res = await os.api("emoji-add-request/create", {
			fileId: d.file.id,
			name: d.name.trim().toLowerCase(),
			alternateName: text(d.alternateName),
			ruby: text(d.ruby),
			description: text(d.description),
			category: text(d.category),
			aliases: d.aliases.split(/[\s　]+/).filter(Boolean),
			sensitive: d.sensitive,
			isTextOnly: textOnly,
			// 文字だけの絵文字は、承認時にライセンスが固定値になるので、ライセンス情報の画面の値は送らない
			motifSelf: textOnly ? null : d.motifSelf,
			motifUserMode: !textOnly && d.motifSelf ? d.motifUserMode : null,
			copyPermission: textOnly ? "none" : isAsk.value ? "conditional" : d.copyPermission,
			askContact: !textOnly && isAsk.value ? text(d.askContact) : null,
			licenseName: textOnly ? null : licenseName.value,
			creator: textOnly ? null : text(d.creator),
			usageInfo: !textOnly && showUsageInfo.value ? text(d.usageInfo) : null,
			copyrightNotice: textOnly ? null : text(d.copyrightNotice),
			creditText: textOnly ? null : text(d.creditText),
			relatedLinks: textOnly ? [] : relatedLinkList.value,
			message: text(d.message),
			source: props.from === "megamoji" ? "megamoji" : "form",
			imageProcessed: d.originalFile != null,
			originalWidth: d.originalFile != null ? d.originalSize?.width ?? null : null,
			originalHeight: d.originalFile != null ? d.originalSize?.height ?? null : null,
		});
		clearDraft();
		submittedId.value = res.id;
		rootEl.value?.scrollIntoView({ block: "start" });
	} catch (err: any) {
		os.alert({
			type: "error",
			text: ERROR_MESSAGES[err?.code] ?? err?.message ?? "申請に失敗しました。",
		});
	} finally {
		submitting.value = false;
	}
}

/** 入力を消して最初から */
function restart(): void {
	Object.assign(d, emptyDraft());
	clearDraft();
	restoredDraft.value = false;
	submittedId.value = null;
	megamojiSimple.value = false;
	goTo("image");
}

// #endregion

// #region 下書き

// NOTE: localStorage が使えない環境（プライベートモードなど）でも、申請はできるようにする
function saveDraft(): void {
	if (megamojiSimple.value || submittedId.value) return;
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft: d, step: step.value }));
	} catch {}
}

function clearDraft(): void {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {}
}

/**
 * 下書きを読み込む。
 *
 * @returns 読み込めたら true
 */
function loadDraft(): boolean {
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return false;
		const saved = JSON.parse(raw) as { draft: Partial<Draft>; step: Step };
		Object.assign(d, emptyDraft(), saved.draft);
		// 下書きの画面が今の流れに無ければ（文字だけ↔ふつうの切り替えなど）、最初の画面から
		step.value = steps.value.includes(saved.step) ? saved.step : "image";
		return true;
	} catch {
		return false;
	}
}

watch([d, step], saveDraft, { deep: true });

// #endregion

// #region MEGAMOJI からの受け取り

/**
 * MEGAMOJI から画像を受け取る。
 *
 * @remarks
 * 送り元が {@link MEGAMOJI_ORIGIN} で、`{ type: "mkkey:emoji-request:image", image: Blob }` の形のものだけを受け付ける。
 * 画像以外のデータ（名前など）は受け取らない（名前は URL で渡してもらう）。受け取った画像は自分のドライブへ上げる。
 *
 * @param ev - 届いたメッセージ
 */
async function onMessage(ev: MessageEvent): Promise<void> {
	if (ev.origin !== MEGAMOJI_ORIGIN) return;
	const data = ev.data as { type?: unknown; image?: unknown } | null;
	if (data?.type !== "mkkey:emoji-request:image" || !(data.image instanceof Blob)) return;
	if (!data.image.type.startsWith("image/")) return;
	uploading.value = true;
	try {
		const ext = data.image.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "png";
		const file = await uploadFile(
			new File([data.image], `${d.name || "megamoji"}.${ext}`, { type: data.image.type }),
			defaultStore.state.uploadFolderEmoji ?? defaultStore.state.uploadFolder,
			undefined,
			true,
			true,
			false,
			{ force: true },
		);
		setFile(file);
	} catch (err) {
		os.alert({ type: "error", text: "MEGAMOJI からの画像の受け取りに失敗しました。画像を選び直してください。" });
		console.error(err);
	} finally {
		uploading.value = false;
	}
}

onMounted(() => {
	if (props.from === "megamoji") {
		// MEGAMOJI から来たときは下書きを使わず、文字だけの絵文字の 3 ステップにする（H4）
		megamojiSimple.value = true;
		d.licenseMode = "textOnly";
		if (props.name) d.name = nameFromFileName(props.name);
		window.addEventListener("message", onMessage);
		// 開いた MEGAMOJI へ、画像を受け取る準備ができたことを知らせる
		window.opener?.postMessage({ type: "mkkey:emoji-request:ready" }, MEGAMOJI_ORIGIN);
		return;
	}
	restoredDraft.value = loadDraft();
	if (props.name && !d.name) d.name = nameFromFileName(props.name);
});

onBeforeUnmount(() => {
	window.removeEventListener("message", onMessage);
});

// #endregion

definePageMetadata({
	title: "絵文字を申請",
	icon: "ph-smiley-sticker ph-bold ph-lg",
});
</script>

<style lang="scss" module>
.root {
	scroll-margin-top: 80px;
}

.progress {
	margin: 0 0 16px;
}

.bars {
	display: flex;
	gap: 4px;
}

.bar {
	flex: 1;
	height: 4px;
	border-radius: 2px;
	background: var(--divider);
}

.barDone {
	background: var(--accent);
}

.progressText {
	margin: 6px 0 0;
	font-size: 0.85em;
	opacity: 0.7;
}

.h {
	margin: 0 0 12px;
	font-size: 1.1em;
}

.subHead {
	margin: 16px 0 8px;
	font-weight: bold;
}

.caption {
	margin: 6px 0 0;
	font-size: 0.85em;
	opacity: 0.7;
	line-height: 1.6;
}

.pre {
	white-space: pre-wrap;
}

.dim {
	opacity: 0.6;
}

.req {
	display: inline-block;
	margin-left: 4px;
	padding: 0 6px;
	border-radius: 6px;
	font-size: 0.75em;
	font-weight: normal;
	background: var(--buttonBg);
	vertical-align: 0.1em;
}

.required {
	background: var(--accent);
	color: var(--fgOnAccent);
}

.errorText {
	color: var(--error);
}

.warnText {
	color: var(--warn);
}

.mono input {
	font-family: monospace;
}

.choices {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.choice {
	display: block;
	width: 100%;
	text-align: left;
	padding: 12px;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.choiceOn {
	border: solid 2px var(--accent);
	padding: 11px;
}

.choiceTitle {
	font-weight: bold;
}

.foldHead {
	display: flex;
	width: 100%;
	align-items: center;
	justify-content: space-between;
	margin: 16px 0 0;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--buttonBg);
	font-weight: bold;
}

.fold {
	padding: 4px 4px 0;
}

.confirmImage {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin: 0 0 12px;

	> img {
		max-width: 70%;
		max-height: 96px;
		object-fit: contain;
	}
}

.section {
	margin: 0 0 16px;
	padding: 10px 12px;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.sectionHead {
	display: flex;
	justify-content: space-between;
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

.smallLink {
	margin: 4px 0 0;
	font-size: 0.8em;
	opacity: 0.7;
}

.messageLabel {
	font-size: 0.85em;
}

.nav {
	display: flex;
	gap: 8px;
	margin: 24px 0 0;
}

.navButton {
	flex: 1;
}

.done {
	text-align: center;
	padding: 24px 0;
}

.doneIcon {
	font-size: 48px;
	color: var(--success);
}

.doneTitle {
	margin: 8px 0 0;
	font-size: 1.2em;
	font-weight: bold;
}

.mt8 {
	margin-top: 8px;
}

.mb12 {
	margin-bottom: 12px;
}
</style>
