<template>
	<div class="zmdxowus">
		<p v-if="choices.length < 1" class="caution">
			<i class="ph-warning ph-bold ph-lg"></i
			>{{ i18n.ts._poll.noOnlyOneChoice }}
		</p>
		<ul>
			<li v-for="(choice, i) in choices" :key="i">
				<MkInput
					class="input"
					small
					:model-value="choice"
					:placeholder="i18n.t('_poll.choiceN', { n: i + 1 })"
					@update:modelValue="onInput(i, String($event ?? ''))"
				>
				</MkInput>
				<button class="_button" @click="remove(i)">
					<i class="ph-x ph-bold ph-lg"></i>
				</button>
			</li>
		</ul>
		<MkButton v-if="choices.length < 20" class="add" @click="add">{{
			i18n.ts.add
		}}</MkButton>
		<MkButton v-else class="add" disabled>{{
			i18n.ts._poll.noMore
		}}</MkButton>
		<MkSwitch v-model="multiple">{{
			i18n.ts._poll.canMultipleVote
		}}</MkSwitch>
		<MkSwitch v-model="hideResults">{{
			i18n.ts._poll.hideResults
		}}</MkSwitch>
		<section>
			<div>
				<MkSelect v-model="expiration" small>
					<template #label>{{ i18n.ts._poll.expiration }}</template>
					<option value="infinite">
						{{ i18n.ts._poll.infinite }}
					</option>
					<option value="at">{{ i18n.ts._poll.at }}</option>
					<option value="after">{{ i18n.ts._poll.after }}</option>
				</MkSelect>
				<section v-if="expiration === 'at'">
					<MkInput v-model="atDate" small type="date" class="input">
						<template #label>{{
							i18n.ts._poll.deadlineDate
						}}</template>
					</MkInput>
					<MkInput v-model="atTime" small type="time" class="input">
						<template #label>{{
							i18n.ts._poll.deadlineTime
						}}</template>
					</MkInput>
				</section>
				<section v-else-if="expiration === 'after'">
					<MkInput v-model="after" small type="number" class="input">
						<template #label>{{ i18n.ts._poll.duration }}</template>
					</MkInput>
					<MkSelect v-model="unit" small>
						<option value="second">
							{{ i18n.ts._time.second }}
						</option>
						<option value="minute">
							{{ i18n.ts._time.minute }}
						</option>
						<option value="hour">{{ i18n.ts._time.hour }}</option>
						<option value="day">{{ i18n.ts._time.day }}</option>
					</MkSelect>
				</section>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 投稿フォーム用の投票（アンケート）編集ブロック。
 * 選択肢・複数投票・結果非表示・期限モードを扱い、親へ v-model でまとめて渡す。
 *
 * @remarks
 * CHANGED: `expiresAt` から `<input type="time">` へ渡す文字列は 24 時間表記（`HH:mm`）。以前の `hh:mm` は 12 時間表記のため下書き復元などで時刻がずれた。
 * NOTE: 期限モード・経過指定・結果非公開の既定は `defaultStore`（アカウント単位）に保存し、次回の新規投票で再利用する。
 * NOTE: 各選択肢は `MAX_POLL_CHOICE_INPUT_LENGTH`（200）文字まで（API `maxLength` と一致。サロゲートペアは 2 コード単位）。
 *
 * @public
 */
import { ref, watch } from "vue";
import MkInput from "./form/input.vue";
import MkSelect from "./form/select.vue";
import MkSwitch from "./form/switch.vue";
import MkButton from "./MkButton.vue";
import { formatDateTimeString } from "@/scripts/format-time-string";
import { addTime } from "@/scripts/time";
import { i18n } from "@/i18n";
import { defaultStore } from "@/store";
import { MAX_POLL_CHOICE_INPUT_LENGTH } from "@/const";

/** 親の `poll` オブジェクトに近い形（期限は下書き等で型がゆるい場合がある） */
type PollEditorModelValue = {
	choices: string[];
	multiple: boolean;
	hideResults?: boolean;
	expiresAt?: number | string | null;
	expiredAfter?: number | string | null;
};

const props = defineProps<{
	modelValue: PollEditorModelValue;
}>();

const emit = defineEmits<{
	(ev: "update:modelValue", v: PollEditorModelValue): void;
}>();

//#region 初期状態（選択肢・スイッチ）
const choices = ref(props.modelValue.choices);
const multiple = ref(props.modelValue.multiple);
const hideResults = ref(props.modelValue.hideResults ?? false);
//#endregion

//#region 期限 UI（モード・日時・経過）
type ExpirationMode = "infinite" | "at" | "after";

/** 経過指定の単位（MkSelect の value と一致） */
type AfterUnit = "second" | "minute" | "hour" | "day";

const expiration = ref<ExpirationMode>("after");
const atDate = ref(
	formatDateTimeString(
		addTime(new Date(), new Date().getHours() >= 22 ? 2 : 1, "day"),
		"yyyy-MM-dd",
	),
);
const atTime = ref("00:00");
const after = ref<number | string>(1);
const unit = ref<AfterUnit>("hour");
//#endregion

//#region modelValue からの初期化（下書き・新規・引用など）
/**
 * `expiresAt` を数値ミリ秒へ正規化する（無効なら null）
 *
 * @param v 親から渡る締切（数値・文字列・null など）
 * @internal
 */
function coerceExpiresAtMs(v: unknown): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

/**
 * `expiredAfter` を数値ミリ秒へ正規化する（無効なら null）
 *
 * @param v 親から渡る経過ミリ秒
 * @internal
 */
function coerceExpiredAfterMs(v: unknown): number | null {
	if (v == null || v === "") return null;
	const n =
		typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
	if (!Number.isFinite(n) || n <= 0) return null;
	return n;
}

const expiresAtMs = coerceExpiresAtMs(props.modelValue.expiresAt);
const expiredAfterMs = coerceExpiredAfterMs(props.modelValue.expiredAfter);

if (expiresAtMs != null) {
	// 絶対日時が指定されているときは日時モード（下書き復元・編集）
	expiration.value = "at";
	const d = new Date(expiresAtMs);
	atDate.value = formatDateTimeString(d, "yyyy-MM-dd");
	// NOTE: `type="time"` は 24 時間表記が前提。`hh` は 12 時間表記のため使わない。
	atTime.value = formatDateTimeString(d, "HH:mm");
} else if (expiredAfterMs != null) {
	// 経過指定が数値で載っているときは秒単位表示に正規化（下書きのミリ秒をそのまま反映）
	expiration.value = "after";
	after.value = expiredAfterMs / 1000;
	unit.value = "second";
} else {
	// 期限フィールドなし＝新規投票: アカウントに保存した UI 既定を復元
	const mode = defaultStore.state.postFormPollExpiration;
	expiration.value =
		mode === "infinite" || mode === "at" || mode === "after" ? mode : "after";
	hideResults.value =
		props.modelValue.hideResults ??
		defaultStore.state.postFormPollHideResults;
	const v = defaultStore.state.postFormPollAfterValue;
	const u = defaultStore.state.postFormPollAfterUnit;
	after.value = typeof v === "number" && Number.isFinite(v) && v >= 1 ? v : 1;
	unit.value =
		u === "second" || u === "minute" || u === "hour" || u === "day"
			? u
			: "hour";
}
//#endregion

/**
 * 選択肢テキストの更新
 *
 * @param i インデックス
 * @param value 新しい文字列
 * @internal
 */
function onInput(i: number, value: string) {
	// API の maxLength（UTF-16 コード単位）に合わせて超過分を切り捨てる
	const v =
		value.length > MAX_POLL_CHOICE_INPUT_LENGTH
			? value.slice(0, MAX_POLL_CHOICE_INPUT_LENGTH)
			: value;
	choices.value[i] = v;
}

/** 選択肢を末尾に追加する */
function add() {
	choices.value.push("");
}

/** 指定インデックスの選択肢を削除する */
function remove(i: number) {
	choices.value = choices.value.filter((_, _i) => _i !== i);
}

//#region 親へ渡すオブジェクトの組み立て
/**
 * 現在の UI 状態を親の `poll` 形へまとめる。
 *
 * @remarks
 * NOTE: 無期限時は `expiresAt` / `expiredAfter` を明示的に null にし、以前のモードの値が残らないようにする。
 *
 * @returns v-model 用オブジェクト
 * @internal
 */
function get(): PollEditorModelValue {
	const calcAt = (): number => {
		return new Date(`${atDate.value} ${atTime.value}`).getTime();
	};

	const calcAfter = (): number | null => {
		const raw = Number.parseInt(String(after.value), 10);
		const base = Number.isFinite(raw) && raw > 0 ? raw : 1;
		const multMs =
			unit.value === "second"
				? 1000
				: unit.value === "minute"
					? 60_000
					: unit.value === "hour"
						? 3_600_000
						: unit.value === "day"
							? 86_400_000
							: null;
		return multMs != null ? base * multMs : null;
	};

	const out: PollEditorModelValue = {
		choices: choices.value,
		multiple: multiple.value,
		hideResults: hideResults.value,
		expiresAt: null,
		expiredAfter: null,
	};

	if (expiration.value === "at") {
		out.expiresAt = calcAt();
	} else if (expiration.value === "after") {
		const ms = calcAfter();
		if (ms != null) out.expiredAfter = ms;
	}
	return out;
}
//#endregion

watch(
	[choices, multiple, hideResults, expiration, atDate, atTime, after, unit],
	() => emit("update:modelValue", get()),
	{ deep: true, immediate: true },
);

//#region アカウント既定（投稿フォームの次回用）への保存
watch(
	[hideResults, expiration, after, unit],
	() => {
		void defaultStore.set("postFormPollHideResults", hideResults.value);
		if (
			expiration.value === "infinite" ||
			expiration.value === "at" ||
			expiration.value === "after"
		) {
			void defaultStore.set("postFormPollExpiration", expiration.value);
		}
		const raw = Number.parseInt(String(after.value), 10);
		if (Number.isFinite(raw) && raw >= 1) {
			void defaultStore.set("postFormPollAfterValue", raw);
		}
		const u = unit.value;
		if (u === "second" || u === "minute" || u === "hour" || u === "day") {
			void defaultStore.set("postFormPollAfterUnit", u);
		}
	},
	{ deep: true, immediate: true },
);
//#endregion
</script>

<style lang="scss" scoped>
.zmdxowus {
	padding: 0.5rem 1rem;

	> .caution {
		margin: 0 0 0.5rem 0;
		font-size: 0.8em;
		color: #f00;

		> i {
			margin-right: 0.25rem;
		}
	}

	> ul {
		display: block;
		margin: 0;
		padding: 0;
		list-style: none;

		> li {
			display: flex;
			margin: 0.5rem 0;
			padding: 0;
			width: 100%;

			> .input {
				flex: 1;
			}

			> button {
				width: 2rem;
				padding: 0.25rem 0;
			}
		}
	}

	> .add {
		margin: 0.5rem 0;
		z-index: 1;
	}

	> section {
		margin: 1rem 0 0 0;

		> div {
			margin: 0 0 0.5rem;
			display: flex;
			flex-direction: row;
			flex-wrap: wrap;
			gap: 0.75rem;

			&:last-child {
				flex: 1 0 auto;

				> div {
					flex-grow: 1;
				}

				> section {
					// MAGIC: Prevent div above from growing unless wrapped to its own line
					flex-grow: 9999;
					align-items: end;
					display: flex;
					gap: 0.25rem;

					> .input {
						flex: 1 1 auto;
					}
				}
			}
		}
	}
}
</style>
