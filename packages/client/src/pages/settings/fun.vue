<template>
	<div class="_formRoot">
		<FormSection>
			<template #label
				>{{ i18n.ts.power
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch data-setting-key="powerMode" v-model="powerMode" class="_formBlock"
				>{{ i18n.ts.powerMode
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch data-setting-key="powerModeColorful"
				v-if="powerMode"
				v-model="powerModeColorful"
				class="_formBlock"
				>{{ i18n.ts.powerModeColorful
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch data-setting-key="powerModeSuperColorful"
				v-if="powerMode"
				v-model="powerModeSuperColorful"
				class="_formBlock"
				>{{ i18n.ts.powerModeSuperColorful
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch data-setting-key="powerModeNoShake"
				v-if="powerMode"
				v-model="powerModeNoShake"
				class="_formBlock"
				>{{ i18n.ts.powerModeNoShake
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormFolder v-if="powerMode" class="_formBlock">
				<template #label>{{ i18n.ts.powerModeOption }}</template>
				<FormRange data-setting-key="powerModeParticleCount"
					v-if="powerMode"
					v-model="powerModeParticleCount"
					:min="0"
					:max="powerModeParticleCount >= 20 ? (Math.floor(powerModeParticleCount / 10) + 1) * 10 : 20"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleCount }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeParticleSize"
					v-if="powerMode"
					v-model="powerModeParticleSize"
					:min="0"
					:max="powerModeParticleSize >= 6 ? (Math.floor(powerModeParticleSize / 3) + 1) * 3 : 6"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleSize }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeParticleX"
					v-if="powerMode"
					v-model="powerModeParticleX"
					:min="powerModeParticleX <= -10 ? (Math.floor(powerModeParticleX / -5) + 1) * -5 : -10"
					:max="powerModeParticleX >= 10 ? (Math.floor(powerModeParticleX / 5) + 1) * 5 : 10"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleX }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeParticleY"
					v-if="powerMode"
					v-model="powerModeParticleY"
					:min="powerModeParticleY <= -10 ? (Math.floor(powerModeParticleY / -5) + 1) * -5 : -10"
					:max="powerModeParticleY >= 10 ? (Math.floor(powerModeParticleY / 5) + 1) * 5 : 10"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleY }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeParticleSpreadX"
					v-if="powerMode"
					v-model="powerModeParticleSpreadX"
					:min="0"
					:max="powerModeParticleSpreadX >= 20 ? (Math.floor(powerModeParticleSpreadX / 10) + 1) * 10 : 20"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleSpreadX }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeParticleSpreadY"
					v-if="powerMode"
					v-model="powerModeParticleSpreadY"
					:min="0"
					:max="powerModeParticleSpreadY >= 20 ? (Math.floor(powerModeParticleSpreadY / 10) + 1) * 10 : 20"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleSpreadY }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeParticleGravity"
					v-if="powerMode"
					v-model="powerModeParticleGravity"
					:min="0"
					:max="powerModeParticleGravity >= 60 ? (Math.floor(powerModeParticleGravity / 30) + 1) * 30 : 60"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeParticleGravity }}</template
					>
				</FormRange>
				<FormRange data-setting-key="powerModeShakePower"
					v-if="powerMode && !powerModeNoShake"
					v-model="powerModeShakePower"
					:min="0"
					:max="powerModeShakePower >= 10 ? (Math.floor(powerModeShakePower / 5) + 1) * 5 : 10"
					:step="1"
					easing
					class="_formBlock"
				>
					<template #label
						>{{ i18n.ts.powerModeShakePower }}</template
					>
				</FormRange>
			</FormFolder>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.item
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch
				v-model="disableNyaise"
				class="_formBlock"
				@update:modelValue="update()"
				>{{ i18n.ts.disableNyaise
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span
				><template #caption>{{
					i18n.ts.disableNyaiseDescription
				}}</template></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.morse
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch data-setting-key="enableMorseDecode" v-model="enableMorseDecode" class="_formBlock"
				>{{ i18n.ts.enableMorseDecode
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.forkids
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch data-setting-key="excludeSimo" v-model="excludeSimo" class="_formBlock"
				>{{ i18n.ts.excludeSimo
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span
				><template #caption>{{
					i18n.ts.excludeSimoDescription
				}}</template></FormSwitch
			>
			<FormSwitch data-setting-key="excludeNSFW" v-model="excludeNSFW" class="_formBlock"
				>{{ i18n.ts.excludeNSFW
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSwitch data-setting-key="excludeNotFollowNSFW"
				:disabled="!excludeNSFW"
				v-model="excludeNotFollowNSFW"
				class="_formBlock"
				>{{ i18n.ts.excludeNotFollowNSFW
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label></template>
			<FormSwitch data-setting-key="postReplaceMark" v-model="postReplaceMark" class="_formBlock"
				>{{ i18n.ts.postReplaceMark
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
			<FormSelect data-setting-key="mcShortName" v-model="mcShortNameMode" class="_formBlock">
				<template #label
					>{{ i18n.ts.mcShortName
					}}<span v-if="showMkkeySettingTips" class="_beta">{{
						i18n.ts.mkkey
					}}</span></template
				>
				<option value="makku">マック</option>
				<option value="makudo">マクド</option>
				<option value="free">{{ i18n.ts.mcShortNameFree }}</option>
				<template #caption>{{ i18n.ts.mcShortNameDescription }}</template>
			</FormSelect>
			<div v-if="mcShortNameMode === 'free'" class="_formBlock mcLetters">
				<button
					v-for="(ch, i) in MC_FULL_NAME"
					:key="i"
					class="_button letter"
					:class="{ on: mcLetterBits[i] }"
					:disabled="!canToggleMcLetter(i)"
					:aria-pressed="mcLetterBits[i]"
					@click="toggleMcLetter(i)"
				>
					{{ ch }}
				</button>
			</div>
			<MkInfo v-if="mcShortNameMode === 'free' && mcShortNameTooLong" warn class="_formBlock">
				{{ i18n.ts.mcShortNameTooLong }}
			</MkInfo>
			<FormButton
				v-if="mcShortNameMode === 'free' && mcShortNameChanged"
				class="_formBlock"
				primary
				inline
				:disabled="mcShortNameSaving || mcShortNameTooLong"
				@click="saveMcShortName"
				><i class="ph-floppy-disk ph-bold ph-lg"></i>
				{{ i18n.ts.save }}</FormButton
			>
			<FormSelect data-setting-key="replaceMakudo" v-model="replaceMakudo" class="_formBlock">
				<template #label>{{ i18n.ts.replaceMakudo }}</template>
				<option value="">{{ i18n.ts.replaceMakudo0 }}</option>
				<option value="makudo">{{ i18n.ts.replaceMakudo1 }}</option>
				<option value="makku">{{ i18n.ts.replaceMakudo2 }}</option>
			</FormSelect>
			<FormSwitch data-setting-key="postStartSleep" v-model="postStartSleep" class="_formBlock"
				>{{ i18n.ts.postStartSleep
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>
		</FormSection>
		<FormSection>
			<template #label
				>{{ i18n.ts.emojiReplace
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></template
			>
			<FormSwitch data-setting-key="enableEmojiReplace" v-model="enableEmojiReplace" class="_formBlock"
				>{{ i18n.ts.enableEmojiReplace
				}}<span v-if="showMkkeySettingTips" class="_beta">{{
					i18n.ts.mkkey
				}}</span></FormSwitch
			>

			<div
				v-panel
				v-if="enableEmojiReplace"
				style="border-radius: 0.375rem"
			>
				<XDraggable data-setting-key="allEmojiReplace"
					v-model="allEmojiReplace"
					class="zoaiodol"
					:item-key="(item) => item"
					animation="150"
					delay="100"
					delay-on-touch-only="true"
				>
					<template #item="{ element }">
						<button
							class="_button item"
							@click="remove(element, $event)"
						>
							<MkEmoji
								:emoji="element"
								:normal="true"
								:nofallback="true"
								noreplace
							/>
						</button>
					</template>
					<template #footer>
						<button class="_button add" @click="chooseEmoji">
							<i class="ph-plus ph-bold ph-lg"></i>
						</button>
					</template>
				</XDraggable>
			</div>
			<FormButton
				v-if="enableEmojiReplace"
				inline
				danger
				@click="setEmpty"
				><i class="ph-trash ph-bold ph-lg"></i>
				{{ i18n.ts.allDelete }}</FormButton
			>
		</FormSection>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 演出や文字変換など、遊びに関する表示設定を管理するページ。
 *
 * @remarks
 * 設定検索は各操作部品の `data-setting-key` を使って、該当項目へ移動し強調する。
 * マクドナルドの短縮名（`$[mc]`）は、リモートへ送るときにも使うのでサーバー（`i/update`）に保存する。
 *
 * @see {@link defaultStore}
 * @internal
 */
import { ref, computed, watch } from "vue";
import { debounce } from "throttle-debounce";
import XDraggable from "vuedraggable";
import FormButton from "@/components/MkButton.vue";
import FormLink from "@/components/form/link.vue";
import FormRange from "@/components/form/range.vue";
import FormSection from "@/components/form/section.vue";
import FormSwitch from "@/components/form/switch.vue";
import FormSelect from "@/components/form/select.vue";
import * as os from "@/os";
import { $i } from "@/account";
import { i18n } from "@/i18n";
import { definePageMetadata } from "@/scripts/page-metadata";
import { defaultStore } from "@/store";
import { unisonReload } from "@/scripts/unison-reload";
import { useIsMobile } from "@/scripts/use-is-mobile";
import { deepClone } from "@/scripts/clone";
import FormFolder from "@/components/form/folder.vue";
import MkInfo from "@/components/MkInfo.vue";
import {
	countMcLetters,
	DEFAULT_MC_LETTER_BITS,
	MC_FULL_NAME,
	MC_SHORT_NAME_MAX_LENGTH,
	MC_INDEX_MA,
	MC_INDEX_SMALL_TSU,
	parseMcLetterBits,
} from "@/scripts/mc-short-name";

const DESKTOP_THRESHOLD = 1100;

const isDesktop = ref(window.innerWidth >= DESKTOP_THRESHOLD);
const isMobile = useIsMobile();

const developer = computed(defaultStore.makeGetterSetter("developer"));
const showMkkeySettingTips = computed(
	defaultStore.makeGetterSetter("showMkkeySettingTips")
);

const powerMode = computed(defaultStore.makeGetterSetter("powerMode"));
const powerModeParticleCount = computed(defaultStore.makeGetterSetter("powerModeParticleCount"));
const powerModeColorful = computed(
	defaultStore.makeGetterSetter("powerModeColorful")
);
const powerModeSuperColorful = computed(
	defaultStore.makeGetterSetter("powerModeSuperColorful")
);
const powerModeParticleX = computed(defaultStore.makeGetterSetter("powerModeParticleX"));
const powerModeParticleY = computed(defaultStore.makeGetterSetter("powerModeParticleY"));
const powerModeParticleSpreadX = computed(defaultStore.makeGetterSetter("powerModeParticleSpreadX"));
const powerModeParticleSpreadY = computed(defaultStore.makeGetterSetter("powerModeParticleSpreadY"));
const powerModeParticleGravity = computed(defaultStore.makeGetterSetter("powerModeParticleGravity"));
const powerModeParticleSize = computed(defaultStore.makeGetterSetter("powerModeParticleSize"));
const powerModeShakePower = computed(defaultStore.makeGetterSetter("powerModeShakePower"));
const powerModeNoShake = computed(
	defaultStore.makeGetterSetter("powerModeNoShake")
);
const enableMorseDecode = computed(
	defaultStore.makeGetterSetter("enableMorseDecode")
);
const excludeSimo = computed(defaultStore.makeGetterSetter("excludeSimo"));
const excludeNSFW = computed(defaultStore.makeGetterSetter("excludeNSFW"));
const excludeNotFollowNSFW = computed(
	defaultStore.makeGetterSetter("excludeNotFollowNSFW")
);
const excludeSensitiveEmoji = computed(
	defaultStore.makeGetterSetter("excludeSensitiveEmoji")
);
const replaceMakudo = computed(
	defaultStore.makeGetterSetter("replaceMakudo")
)
const postReplaceMark = computed(
	defaultStore.makeGetterSetter("postReplaceMark")
);
const postStartSleep = computed(
	defaultStore.makeGetterSetter("postStartSleep")
);
let allEmojiReplace = $ref(deepClone(defaultStore.state.allEmojiReplace));
const enableEmojiReplace = computed(
	defaultStore.makeGetterSetter("enableEmojiReplace")
);
let disableNyaise = $ref($i.disableNyaise);

// #region マクドナルドの短縮名
/**
 * マクドナルドの短縮名の選び方（マック / マクド / 自由に指定）
 *
 * @remarks
 * 保存する値は `makku` / `makudo` / `free:xxxxxxx`（{@link saveMcShortName}）。
 * 自由に指定では、マ・ッ・ク・ド・ナ・ル・ドの 7 文字それぞれを使うか（{@link mcLetterBits}）を選ぶ。
 * 自由に指定のときは、どんな名前になるかは出さない（投稿で見てのお楽しみ）。
 *
 * 保存はプロフィール更新（`i/update`）で、回数制限があるので送る回数を抑える。
 * - マック / マクド … 選んでから少し待って（{@link MC_SAVE_DEBOUNCE_MS}）自動で保存する。続けて切り替えても最後の 1 回だけ送る。
 * - 自由に指定 … 文字を選び終えてから保存ボタンで送る。送信中はボタンを押せない。
 */
const initialMcBits = parseMcLetterBits($i.mcShortName);
const mcShortNameMode = ref<"makku" | "makudo" | "free">(
	initialMcBits ? "free" : $i.mcShortName === "makudo" ? "makudo" : "makku"
);
/** 自由に指定のときの、7 文字それぞれを使うか。初めて切り替えたときはマック（マ・ッ・ク）から始める */
const mcLetterBits = ref<boolean[]>(initialMcBits ?? [...DEFAULT_MC_LETTER_BITS]);

/** 今の選び方を保存する値にする */
function getMcSettingValue(): string {
	if (mcShortNameMode.value !== "free") return mcShortNameMode.value;
	return `free:${mcLetterBits.value.map((b) => (b ? "1" : "0")).join("")}`;
}

/**
 * 最後に保存した値（未設定はマックと同じ）
 *
 * @remarks
 * NOTE: 以前に保存された 6 文字以上の設定は、サーバーでもマック扱いになる（`misc/mc-short-name.ts`）。
 * そのため画面でもマックが選ばれている状態として扱い、保存し直さなくてよいようにしている。
 */
// 未設定と、使えない値（6 文字以上など。表示ではマック扱い）は、マックとして扱う
const savedMcSetting = ref<string>(
	initialMcBits || $i.mcShortName === "makudo" ? $i.mcShortName! : "makku"
);

/** 保存していない変更があるか（あるときだけ保存ボタンを出す） */
const mcShortNameChanged = computed(
	() => getMcSettingValue() !== savedMcSetting.value
);

/**
 * 1 文字をオンオフしたときの並びを求める
 *
 * @remarks
 * 「ッ」は「マ」と一緒にしか使えないので、ッ をオンにしたら マ もオンにし、マ をオフにしたら ッ もオフにする。
 *
 * @param index - 文字の位置（0〜6）
 * @returns オンオフした後の並び
 */
function toggledMcBits(index: number): boolean[] {
	const bits = [...mcLetterBits.value];
	bits[index] = !bits[index];
	if (index === MC_INDEX_SMALL_TSU && bits[index]) bits[MC_INDEX_MA] = true;
	if (index === MC_INDEX_MA && !bits[index]) bits[MC_INDEX_SMALL_TSU] = false;
	return bits;
}

/**
 * その文字をオンオフできるか
 *
 * @remarks
 * オンオフした結果が 0 文字になるなら押せない（最後の 1 文字や、マ と ッ だけのときの マ）。
 *
 * @param index - 文字の位置（0〜6）
 * @returns オンオフできるなら true
 */
function canToggleMcLetter(index: number): boolean {
	return toggledMcBits(index).some(Boolean);
}

/**
 * 自由に指定の 1 文字をオンオフする
 *
 * @param index - 文字の位置（0〜6）
 */
function toggleMcLetter(index: number): void {
	if (!canToggleMcLetter(index)) return;
	mcLetterBits.value = toggledMcBits(index);
}

/**
 * 自由に指定で選んだ文字が多すぎるか（6 文字以上は短縮名になっていないので保存できない）
 */
const mcShortNameTooLong = computed(
	() =>
		mcShortNameMode.value === "free" &&
		countMcLetters(mcLetterBits.value) > MC_SHORT_NAME_MAX_LENGTH
);

/** 保存の送信中か（保存ボタンの連打を防ぐ） */
const mcShortNameSaving = ref(false);

/** マック / マクドを選んでから自動で保存するまでの待ち時間（ミリ秒） */
const MC_SAVE_DEBOUNCE_MS = 1000;

/** 短縮名の設定をサーバーに保存する（リモートへ送るときにも投稿者の設定として使うため） */
async function saveMcShortName(): Promise<void> {
	if (
		mcShortNameSaving.value ||
		!mcShortNameChanged.value ||
		mcShortNameTooLong.value
	)
		return;
	const value = getMcSettingValue();
	mcShortNameSaving.value = true;
	try {
		await os.apiWithDialog("i/update", { mcShortName: value });
		$i.mcShortName = value;
		savedMcSetting.value = value;
	} finally {
		mcShortNameSaving.value = false;
	}
}

/** マック / マクドを選んだときの自動保存（続けて切り替えたら最後の 1 回だけ送る） */
const saveMcShortNameDebounced = debounce(MC_SAVE_DEBOUNCE_MS, () => {
	// 待っている間に自由に指定へ切り替えたら、保存ボタンに任せる
	if (mcShortNameMode.value !== "free") saveMcShortName();
});

watch(mcShortNameMode, (mode) => {
	if (mode !== "free") saveMcShortNameDebounced();
});
// #endregion

function chooseEmoji(ev: MouseEvent) {
	os.pickEmoji(ev.currentTarget ?? ev.target, {
		showPinned: false,
		asReactionPicker: true,
	}).then((emoji) => {
		if (!allEmojiReplace.includes(emoji)) {
			allEmojiReplace.push(emoji);
		}
	});
}

function remove(reaction, ev: MouseEvent) {
	os.popupMenu(
		[
			{
				text: reaction.replace(/@(\S+)$/, "").replaceAll(":", ""),
				type: "label",
			},
			reaction.includes("@")
				? {
						text: reaction
							.replace(/^(\S+)@/, "@")
							.replaceAll(":", ""),
						type: "label",
				  }
				: undefined,
			{
				text: i18n.ts.remove,
				action: () => {
					allEmojiReplace = allEmojiReplace.filter(
						(x) => x !== reaction
					);
				},
			},
		].filter((x) => x !== undefined),
		ev.currentTarget ?? ev.target
	);
}

watch(
	[$$(allEmojiReplace)],
	() => {
		save();
	},
	{
		deep: true,
	}
);

function save() {
	defaultStore.set("allEmojiReplace", allEmojiReplace);
}

function update() {
	os.api("i/update", {
		disableNyaise: !!disableNyaise,
	});
}

async function setEmpty() {
	const { canceled } = await os.confirm({
		type: "warning",
		text: i18n.ts.deleteReactionAreYouSure,
	});
	if (canceled) return;

	allEmojiReplace = [];
}

async function reloadAsk() {
	const { canceled } = await os.confirm({
		type: "info",
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

watch([powerMode], async () => {
	await reloadAsk();
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.funSetting,
	icon: "ph-confetti ph-bold ph-lg",
});
</script>

<style lang="scss" scoped>
// マ・ッ・ク・ド・ナ・ル・ドの 7 つのボタンを、なるべく 1 行に収める。
// 幅が足りないときはボタンを縮めて合わせ、それでも収まらない極端に狭い画面でだけ折り返す。
.mcLetters {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.25rem;

	> .letter {
		flex: 1 1 0;
		min-width: 1.75em;
		max-width: 3rem;
		padding: 0.5rem 0;
		text-align: center;
		border-radius: 0.5rem;
		border: solid 1px var(--divider);
		color: var(--fgTransparentWeak);
		font-size: 1.1em;

		&.on {
			background: var(--accent);
			border-color: var(--accent);
			color: var(--fgOnAccent);
		}

		&:disabled {
			cursor: not-allowed;
		}
	}
}

.zoaiodol {
	padding: 0.75rem;
	font-size: 1.1em;

	> .item {
		display: inline-block;
		padding: 0.5rem;
		cursor: move;
	}

	> .add {
		display: inline-block;
		padding: 0.5rem;
	}
}
</style>
