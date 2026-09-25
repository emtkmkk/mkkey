<template>
	<div :class="$style.root">
		<!-- 左上の小さなプレビュー（点線は画像の範囲。ここだけに付ける） -->
		<div :class="$style.summary">
			<div :class="$style.thumb">
				<img :src="file.url" :class="$style.thumbImg" alt="" />
			</div>
			<div :class="$style.meta">
				<div :class="$style.fileName">{{ file.name }}</div>
				<template v-if="analysis">
					<div>サイズ: {{ num(analysis.width) }} × {{ num(analysis.height) }}</div>
					<div :class="{ [$style.warnText]: analysis.sizeWarning }">
						合計ピクセル: {{ num(analysis.width * analysis.height) }}（推奨 16万以下）
					</div>
				</template>
				<div v-else-if="analyzing" :class="$style.dim">調べています…</div>
				<button class="_textButton" @click="emit('reselect', $event)">
					<i class="ph-image-square ph-bold"></i> 画像を選び直す
				</button>
			</div>
		</div>

		<div v-if="originalFile && originalFile.id !== file.id" :class="$style.processed">
			<i class="ph-magic-wand ph-bold"></i>
			加工済み（元: {{ num(originalSize?.width ?? 0) }} × {{ num(originalSize?.height ?? 0) }}）
			<button class="_textButton" @click="emit('restore')">元に戻す</button>
		</div>

		<!-- 警告と加工のボタン（アニメーション画像では加工のボタンを出さない） -->
		<MkInfo v-if="analysis?.marginWarning" warn :class="$style.warn">
			左右に透明な余白があります。絵文字が実際より小さく表示されてしまう可能性があります。
			<div :class="$style.warnActions">
				<MkButton inline small :disabled="working" @click="cut()">
					<i class="ph-scissors ph-bold"></i> 余白をカット
				</MkButton>
			</div>
		</MkInfo>
		<MkInfo v-if="analysis?.sizeWarning" warn :class="$style.warn">
			画像サイズが大きめです。この縦横比なら
			{{ num(analysis.recommended.width) }} × {{ num(analysis.recommended.height) }}
			程度までが目安です。意図しているものである場合は、このまま申請しても問題ありません。
			<div v-if="!analysis.animated" :class="$style.warnActions">
				<MkButton inline small :disabled="working" @click="shrink()">
					<i class="ph-arrows-in ph-bold"></i> 目安サイズに縮小
				</MkButton>
			</div>
		</MkInfo>

		<!-- 背景ごとの見え方。横長（縦横比 2 以上）は縦に積む -->
		<div :class="$style.label"><i class="ph-circle-half ph-bold"></i> 背景ごとの見え方</div>
		<div :class="isWide ? $style.bgStack : $style.bgGrid">
			<div
				v-for="bg in BACKGROUNDS"
				:key="bg"
				:class="$style.bg"
				:style="{ background: bg }"
			>
				<img :src="file.url" :class="$style.bgImg" alt="" />
			</div>
		</div>

		<!-- 実際の見え方。見た目を実物と合わせるため、本物の MkEmoji に仮の絵文字として渡して描く -->
		<!-- 実際の見え方。見た目を実物と合わせるため、本物の投稿・リアクションの部品に仮の投稿を渡して描く。
			押しても何も起きないよう、操作は受け付けない -->
		<div :class="$style.label"><i class="ph-chat-circle ph-bold"></i> 投稿の中</div>
		<div :key="file.id" :class="[$style.note, $style.inert]" inert>
			<MkNoteSimple :note="previewNote" />
		</div>
		<div :class="$style.label"><i class="ph-smiley ph-bold"></i> リアクション・ピッカー</div>
		<div :key="file.id" :class="[$style.reactions, $style.inert]" inert>
			<XReaction :reaction="PREVIEW_CODE" :count="3" :is-initial="true" :note="previewNote" />
			<span :class="$style.pickerCell">
				<MkEmoji
					:emoji="PREVIEW_CODE"
					:custom-emojis="previewEmojis"
					is-picker
					normal
					noreplace
					nofallback
					:class="$style.pickerEmoji"
				/>
			</span>
		</div>

		<p :class="$style.guide">
			縦 256px 程度・四隅の余白は削るのがおすすめ。<br />ダーク・ライトの両方で見やすいか確認してください。
		</p>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字の申請画像を確かめる部品（申請画面の「画像」の画面と、審査画面で共通）。
 *
 * @remarks
 * - サイズと合計ピクセル（推奨 16万以下）、左右の透明な余白（合計 4px 以上）を調べて警告する（B6・I4・I5）
 * - 警告の中に［余白をカット］［目安サイズに縮小］を置く。押したときだけブラウザで加工し、加工した画像をドライブへ上げて processed で返す（I1）
 * - アニメーション画像は加工すると 1 コマ目だけになるので、加工のボタンを出さない
 * - 画像の範囲を示す点線は左上の小さなプレビューだけ。背景ごと・投稿の中・リアクションでは付けない（K7）
 * - 「投稿の中」「リアクション」は、本物の投稿（MkNoteSimple）・リアクションの部品に仮の投稿を渡して描く（見た目を実物とそろえるため）
 * - 元の画像（originalFile）が渡されていて今の画像と違えば「加工済み」と［元に戻す］を出す
 * 画像はオブジェクトストレージから読み込む（CORS は許可されている）。
 *
 * @internal
 */
import { computed, ref, watch } from "vue";
import * as Misskey from "calckey-js";
import MkButton from "@/components/MkButton.vue";
import MkInfo from "@/components/MkInfo.vue";
import MkEmoji from "@/components/global/MkEmoji.vue";
import MkNoteSimple from "@/components/MkNoteSimple.vue";
import XReaction from "@/components/MkReactionsViewer.reaction.vue";
import { $i } from "@/account";
import * as os from "@/os";
import { defaultStore } from "@/store";
import { uploadFile } from "@/scripts/upload";
import {
	analyzeEmojiImage,
	cropEmojiHorizontalMargins,
	shrinkEmojiToRecommended,
	type EmojiImageAnalysis,
} from "@/scripts/emoji-image-tools";

const props = defineProps<{
	/** 今の画像 */
	file: Misskey.entities.DriveFile;
	/** 加工する前の画像（加工していなければ null か file と同じ） */
	originalFile?: Misskey.entities.DriveFile | null;
}>();

const emit = defineEmits<{
	/** 加工した画像をドライブへ上げた。original は加工前の幅・高さ */
	(ev: "processed", v: { file: Misskey.entities.DriveFile; original: { width: number; height: number } }): void;
	/** 元の画像に戻したい */
	(ev: "restore"): void;
	/** 画像を選び直したい */
	(ev: "reselect", e: MouseEvent): void;
	/** 調べた結果（申請画面の確認や審査画面の警告に使う） */
	(ev: "analyzed", v: EmojiImageAnalysis | null): void;
}>();

/** 背景ごとの見え方で使う色（黒・濃い灰色・薄い灰色・白） */
const BACKGROUNDS = ["#000", "#222", "#ddd", "#fff"] as const;

/** プレビュー用の仮の絵文字名（実在の絵文字と重ならない名前） */
const PREVIEW_NAME = "emoji_request_preview";
const PREVIEW_CODE = `:${PREVIEW_NAME}:`;

/** MkEmoji に渡す仮の絵文字（今の画像を指す） */
const previewEmojis = computed(() => [{ name: PREVIEW_NAME, url: props.file.url }] as any[]);

/**
 * プレビュー用の仮の投稿（自分が「今日も :絵文字: です」と投稿し、その絵文字のリアクションが 3 つ付いた形）。
 *
 * @remarks
 * 投稿の部品・リアクションの部品が読む項目だけをそろえている。サーバーには存在しない投稿なので、
 * 押したときの API 呼び出しが起きないよう、表示側で操作を止めている（inert）。
 */
const previewNote = computed(
	() =>
		({
			id: "emoji-request-preview",
			createdAt: new Date().toISOString(),
			updatedAt: null,
			deletedAt: null,
			userId: $i?.id,
			user: $i,
			text: `今日も ${PREVIEW_CODE} です`,
			cw: null,
			visibility: "public",
			localOnly: false,
			replyId: null,
			reply: null,
			renoteId: null,
			renote: null,
			files: [],
			fileIds: [],
			poll: null,
			references: [],
			emojis: previewEmojis.value,
			reactionEmojis: previewEmojis.value,
			reactions: { [PREVIEW_CODE]: 3 },
			myReaction: null,
		}) as any,
);

const analysis = ref<EmojiImageAnalysis | null>(null);
const analyzing = ref(false);
const working = ref(false);
const originalSize = ref<{ width: number; height: number } | null>(null);

const isWide = computed(() =>
	analysis.value ? analysis.value.width / analysis.value.height >= 2 : false,
);

/** 3 桁区切りにする */
function num(n: number): string {
	return n.toLocaleString();
}

/**
 * 画像を読み込む。
 *
 * @param f - ドライブのファイル
 * @returns 画像の中身
 */
async function fetchBlob(f: Misskey.entities.DriveFile): Promise<Blob> {
	const res = await fetch(f.url);
	if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
	return await res.blob();
}

/** 今の画像を調べ直す */
async function analyze(): Promise<void> {
	analyzing.value = true;
	try {
		analysis.value = await analyzeEmojiImage(await fetchBlob(props.file));
	} catch {
		// 読み込めなかったときは警告を出さずに進める（申請は止めない）
		analysis.value = null;
	} finally {
		analyzing.value = false;
		emit("analyzed", analysis.value);
	}
}

/** 元の画像のサイズを覚えておく（「加工済み（元: …）」の表示と、申請に記録するため） */
async function measureOriginal(): Promise<void> {
	const f = props.originalFile;
	if (f == null || f.id === props.file.id) {
		originalSize.value = null;
		return;
	}
	const props2 = f.properties as { width?: number; height?: number } | undefined;
	if (props2?.width && props2?.height) {
		originalSize.value = { width: props2.width, height: props2.height };
		return;
	}
	try {
		const a = await analyzeEmojiImage(await fetchBlob(f));
		originalSize.value = { width: a.width, height: a.height };
	} catch {
		originalSize.value = null;
	}
}

watch(() => props.file.id, analyze, { immediate: true });
watch(() => [props.file.id, props.originalFile?.id], measureOriginal, { immediate: true });

/**
 * 加工した画像をドライブへ上げて、processed で返す。
 *
 * @param make - 今の画像から加工した画像を作る処理
 */
async function process(make: (blob: Blob) => Promise<Blob>): Promise<void> {
	if (analysis.value == null) return;
	working.value = true;
	try {
		const before = { width: analysis.value.width, height: analysis.value.height };
		const blob = await make(await fetchBlob(props.file));
		const name = props.file.name.replace(/\.\w+$/, "") + ".png";
		const uploaded = await uploadFile(
			new File([blob], name, { type: "image/png" }),
			defaultStore.state.uploadFolderEmoji ?? defaultStore.state.uploadFolder,
			undefined,
			true, // 加工した画像を、さらに圧縮しない
			true,
			false,
			{ force: true },
		);
		emit("processed", {
			file: uploaded,
			// 何度か加工しても、最初の画像のサイズを元として記録する
			original: originalSize.value ?? before,
		});
	} catch (err) {
		os.alert({ type: "error", text: "画像の加工に失敗しました。" });
		console.error(err);
	} finally {
		working.value = false;
	}
}

/** 左右の透明な余白を削る */
function cut(): void {
	const margins = analysis.value?.margins;
	if (margins == null) return;
	process((blob) => cropEmojiHorizontalMargins(blob, margins));
}

/** 目安のサイズまで縮める */
function shrink(): void {
	process((blob) => shrinkEmojiToRecommended(blob));
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
}

.summary {
	display: flex;
	gap: 10px;
	align-items: center;
}

.thumb {
	flex: none;
	width: 84px;
	height: 60px;
	border-radius: 10px;
	background: var(--buttonBg);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.thumbImg {
	max-width: 76px;
	max-height: 52px;
	outline: 1px dashed var(--fgTransparentWeak);
}

.meta {
	min-width: 0;
	font-size: 0.85em;
	line-height: 1.65;
	opacity: 0.85;
}

.fileName {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dim {
	opacity: 0.6;
}

.warnText {
	color: var(--warn);
}

.processed {
	margin: 6px 0 0;
	font-size: 0.8em;
	color: var(--accent);
}

.warn {
	margin: 8px 0 0;
}

.warnActions {
	margin: 6px 0 0;
}

.label {
	margin: 12px 0 4px;
	font-size: 0.85em;
	opacity: 0.8;
}

.bgGrid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 4px;
}

.bgStack {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.bg {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 48px;
	padding: 6px;
	border-radius: 6px;
	box-sizing: border-box;
}

.bgImg {
	max-width: 100%;
	height: 32px;
	object-fit: contain;
}

.note {
	padding: 8px 10px;
	border: solid 1px var(--divider);
	border-radius: 10px;
	overflow: hidden;
}

.reactions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.inert {
	pointer-events: none;
	user-select: none;
}

.pickerCell {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	border: solid 1px var(--divider);
	border-radius: 8px;
}

.pickerEmoji {
	max-width: 34px;
	max-height: 34px;
}

.guide {
	margin: 10px 0 0;
	font-size: 0.8em;
	opacity: 0.6;
	line-height: 1.6;
}
</style>
