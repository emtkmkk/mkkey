<template>
	<div class="tivcixzd" :class="{ done: closed || isVoted }">
		<ul>
			<li
				v-for="(choice, i) in note.poll.choices"
				:key="i"
				:class="choiceRowClass(i, choice)"
				@click.stop="onChoiceRowClick(i)"
			>
				<div
					class="backdrop"
					:style="{
						width: `${
							showResult ? (choice.votes / total) * 100 : 0
						}%`,
					}"
				></div>
				<span>
					<template v-if="props.note.poll.multiple">
						<i
							class="ph-bold ph-lg checkIcon multipleIcon"
							:class="
								showChoiceCheck(i, choice)
									? ['ph-check-square', 'checked']
									: 'ph-square'
							"
						></i>
					</template>
					<template v-else-if="showChoiceCheck(i, choice)">
						<i class="ph-check ph-bold ph-lg singleIcon"></i>
					</template>
					<Mfm
						:text="choice.text"
						:plain="true"
						:custom-emojis="note.emojis"
					/>
					<span v-if="showResult" class="votes"
						>({{
							i18n.t("_poll.votesCount", { n: choice.votes })
						}})</span
					>
				</span>
			</li>
		</ul>
		<div v-if="showMultipleSubmitRow" class="pollSubmitRow">
			<MkButton
				class="pollSubmitButton _buttonGradate"
				primary
				:disabled="multipleSubmitDisabled"
				@click.stop="submitMultiplePoll"
			>
				{{ i18n.t("_poll.voteWithCount", { n: multipleSelectedCount }) }}
				<i class="ph-paper-plane-tilt ph-bold ph-lg submitIcon"></i>
			</MkButton>
		</div>
		<p v-if="!readOnly">
			<span>{{ i18n.t("_poll.totalVotes", { n: total }) }}</span>
			<span v-if="canShowResults && !closed && !isVoted">
				<span> · </span>
				<a @click.stop="showResult = !showResult">{{
					showResult ? i18n.ts._poll.vote : i18n.ts._poll.showResult
				}}</a>
			</span>
			<span v-if="!isLocal">
				<span> · </span>
				<a @click.stop="refresh">{{ i18n.ts.reload }}</a>
			</span>
			<span v-if="isVoted"> · {{ i18n.ts._poll.voted }}</span>
			<span v-else-if="closed"> · {{ i18n.ts._poll.closed }}</span>
			<span v-if="remaining > 0"> · {{ timer }}</span>
		</p>
	</div>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * ノートに付いたアンケート（投票）の表示・投票 UI。
 *
 * @remarks
 * - **単一回答**: 従来どおり、肢クリック → 確認 → `choice` で API。
 * - **複数回答可**: 肢はクリックで選択トグル（枠線+チェック）。一覧下の「投票（n）」で確認後に `choices` 一括送信。キーボード専用操作は実装しない。
 * - **投票済み**（いずれかに `isVoted`）: 単一完了時と同様の `done`・「投票済み」表示。複数は票の入った肢にチェックが複数付く。
 * - **通知**: サーバー側で複数回答の 2 票目以降は pollVote 通知を抑止（本コンポーネントは `hasVoted` で追加入力を出さない）。
 *
 * @public
 */
import { computed, ref, watch } from "vue";
import * as misskey from "calckey-js";
import { sum } from "@/scripts/array";
import { pleaseLogin } from "@/scripts/please-login";
import * as os from "@/os";
import { i18n } from "@/i18n";
import { useInterval } from "@/scripts/use-interval";
import { $i } from "@/account";
import MkButton from "@/components/MkButton.vue";

const props = defineProps<{
	note: misskey.entities.Note;
	readOnly?: boolean;
}>();

//#region 期限・表示
const remaining = ref(-1);

const timer = computed(() =>
	i18n.t(
		remaining.value >= 86400
			? "_poll.remainingDays"
			: remaining.value >= 3600
			? "_poll.remainingHours"
			: remaining.value >= 60
			? "_poll.remainingMinutes"
			: "_poll.remainingSeconds",
		{
			s: Math.floor(remaining.value % 60),
			m: Math.floor(remaining.value / 60) % 60,
			h: Math.floor(remaining.value / 3600) % 24,
			d: Math.floor(remaining.value / 86400),
		},
	),
);

if (props.note.poll.expiresAt) {
	const tick = () => {
		remaining.value = Math.floor(
			Math.max(
				new Date(props.note.poll.expiresAt).getTime() - Date.now(),
				0,
			) / 1000,
		);
		if (remaining.value === 0) {
			showResult.value = true;
		}
	};

	useInterval(tick, 3000, {
		immediate: true,
		afterMounted: false,
	});
}
//#endregion

//#region 投票状態（サーバー・複数用ローカル選択）
const hasVoted = computed(() =>
	props.note.poll.choices.some((choice) => choice.isVoted),
);

/** 単一・複数とも「1 票でも入っていれば」完了扱い（done・投票済み文言） */
const isVoted = computed(() => hasVoted.value);

/** 複数回答で未投票のときだけ、送信前にトグルした肢 index */
const selectedIndices = ref<Set<number>>(new Set());

/** 一括送信中（二重送信防止） */
const submittingMultiple = ref(false);

watch(
	() => props.note.id,
	() => {
		selectedIndices.value = new Set();
	},
);

const multipleSelectedCount = computed(() => selectedIndices.value.size);

const showMultipleSubmitRow = computed(
	() =>
		!props.readOnly &&
		props.note.poll.multiple === true &&
		!hasVoted.value &&
		!closed.value,
);

const multipleSubmitDisabled = computed(
	() =>
		submittingMultiple.value ||
		multipleSelectedCount.value < 1 ||
		closed.value,
);
//#endregion

//#region 集計・権限
const isOwner = computed(() => $i?.id === props.note.userId);
const closed = computed(() => {
	// NOTE: 期限到達済みで画面に来た初期表示でも結果を出せるよう、remaining だけでなく expiresAt も見る
	const expiredByRemaining = remaining.value === 0;
	const expiredByDate =
		props.note.poll.expiresAt != null &&
		new Date(props.note.poll.expiresAt).getTime() <= Date.now();
	return expiredByRemaining || expiredByDate;
});
const canShowResults = computed(() => {
	if (!props.note.poll.hideResults) return true;
	return isOwner.value || hasVoted.value || closed.value;
});
const total = computed(() => {
	const choiceTotal = sum(props.note.poll.choices.map((x) => x.votes));
	const totalVotes = props.note.poll.totalVotes ?? 0;
	return Math.max(totalVotes, choiceTotal);
});
const isLocal = computed(() => !props.note.uri);
//#endregion

const showResult = ref(props.readOnly || isVoted.value || closed.value);

watch(canShowResults, (value) => {
	if (!value) {
		showResult.value = false;
	} else if (
		props.note.poll.hideResults &&
		(hasVoted.value || closed.value)
	) {
		showResult.value = true;
	}
});

/**
 * 行に付けるクラス（複数回答の未投票時は `selected` で枠を付ける）。
 *
 * @param index 選択肢 index
 * @param choice パック済み選択肢
 * @internal
 */
function choiceRowClass(
	index: number,
	choice: { isVoted: boolean; text: string; votes: number },
) {
	const selected =
		props.note.poll.multiple &&
		!hasVoted.value &&
		selectedIndices.value.has(index);
	return {
		voted: choice.isVoted,
		selected,
	};
}

/**
 * チェックアイコンを出すか（サーバー上の投票済み or 複数の送信前選択）。
 *
 * @param index 選択肢 index
 * @param choice パック済み選択肢
 * @internal
 */
function showChoiceCheck(
	index: number,
	choice: { isVoted: boolean; text: string; votes: number },
) {
	if (choice.isVoted) return true;
	return (
		props.note.poll.multiple &&
		!hasVoted.value &&
		selectedIndices.value.has(index)
	);
}

async function refresh() {
	if (!props.note.uri) {
		const obj = await os.api("notes/show", { noteId: props.note.id });
		if (obj.poll) {
			props.note.poll = obj.poll;
		}
		return;
	}
	const obj = await os.apiWithDialog("ap/show", { uri: props.note.uri });
	if (obj.type === "Note" && obj.object.poll) {
		props.note.poll = obj.object.poll;
	}
}

/**
 * 選択肢行クリック（単一は即投票フロー、複数は選択トグル）。
 *
 * @param index クリックされた選択肢 index
 * @internal
 */
function onChoiceRowClick(index: number) {
	if (props.readOnly || closed.value || isVoted.value) return;
	if (props.note.poll.multiple) {
		const next = new Set(selectedIndices.value);
		if (next.has(index)) {
			next.delete(index);
		} else {
			next.add(index);
		}
		selectedIndices.value = next;
		return;
	}
	void voteSingle(index);
}

/**
 * 単一回答アンケートで 1 肢に投票する（従来どおり確認付き `choice`）。
 *
 * @param id 選択肢 index
 * @internal
 */
async function voteSingle(id: number) {
	pleaseLogin();

	const { canceled } = await os.confirm({
		type: "question",
		text: i18n.t("voteConfirm", {
			choice: props.note.poll.choices[id].text,
		}),
	});
	if (canceled) return;

	await os.api("notes/polls/vote", {
		noteId: props.note.id,
		choice: id,
	});
	await afterVoteSuccess();
}

/**
 * 複数回答用の一括送信（確認 → `choices`）。
 *
 * @remarks
 * NOTE: 確認文は 1 件のとき `voteConfirm`、2 件以上は件数のみの `voteConfirmMultipleCount`。
 * @internal
 */
async function submitMultiplePoll() {
	pleaseLogin();
	if (props.readOnly || closed.value || hasVoted.value) return;
	const n = multipleSelectedCount.value;
	if (n < 1) return;

	const sorted = [...selectedIndices.value].sort((a, b) => a - b);
	const confirmText =
		n === 1
			? i18n.t("voteConfirm", {
					choice: props.note.poll.choices[sorted[0]!].text,
				})
			: i18n.t("voteConfirmMultipleCount", { n });

	const { canceled } = await os.confirm({
		type: "question",
		text: confirmText,
	});
	if (canceled) return;

	submittingMultiple.value = true;
	try {
		await os.api("notes/polls/vote", {
			noteId: props.note.id,
			choices: sorted,
		});
		selectedIndices.value = new Set();
		await afterVoteSuccess();
	} finally {
		submittingMultiple.value = false;
	}
}

/**
 * 投票 API 成功後の表示更新（結果非公開時は再取得）。
 *
 * @internal
 */
async function afterVoteSuccess() {
	if (props.note.poll.hideResults) {
		showResult.value = true;
		await refresh();
	} else if (!showResult.value) {
		showResult.value = true;
	}
}
</script>

<style lang="scss" scoped>
.tivcixzd {
	> ul {
		display: block;
		margin: 0;
		padding: 0;
		list-style: none;

		> li {
			display: block;
			position: relative;
			margin: 0.25rem 0;
			padding: 0.25rem;
			background: var(--accentedBg);
			border-radius: 0.25rem;
			overflow: hidden;
			cursor: pointer;

			&.selected {
				// NOTE: border ではなく inset shadow で選択枠を描画し、レイアウトシフトを防ぐ
				box-shadow: inset 0 0 0 0.125rem var(--accent);
			}

			> .backdrop {
				position: absolute;
				top: 0;
				left: 0;
				height: 100%;
				background: var(--accent);
				background: linear-gradient(
					90deg,
					var(--buttonGradateA),
					var(--buttonGradateB),
				);
				transition: width 1s ease;
			}

			> span {
				position: relative;
				display: inline-block;
				padding: 0.1875rem 0.3125rem;
				line-height: 1.4;
				background: var(--tlPanel);
				border-radius: 0.1875rem;

				> .singleIcon {
					margin-right: 0.25rem;
					color: var(--accent);
				}

				> .multipleIcon {
					display: inline-block;
					width: 1.25rem;
					margin-right: 0.25rem;
					color: var(--fg);
				}

				> .multipleIcon.checked {
					color: var(--accent);
				}

				> .votes {
					margin-left: 0.25rem;
					opacity: 0.7;
				}
			}
		}
	}

	.pollSubmitRow {
		margin-top: 0.375rem;
		display: flex;
		justify-content: flex-end;
	}

	.pollSubmitButton {
		display: inline-flex;
		align-items: center;
		margin-right: 0;
		margin-left: 0;
		padding: 0 0.75rem;
		line-height: 2.125rem;
		font-weight: bold;
		border-radius: 0.25rem;
		// NOTE: MkNote 側で font-size が縮むため、em ではなく rem で投稿フォーム相当の見た目を維持する
		font-size: 0.9rem;

		:deep(.content) {
			display: inline-flex;
			align-items: center;
		}
	}

	.pollSubmitButton .submitIcon {
		margin-left: 0.375rem;
	}

	.pollSubmitButton:disabled {
		opacity: 0.7;
	}

	> .pollSubmitRow {
		.submitIcon {
			color: currentColor;
		}
	}

	> p {
		color: var(--fg);

		a {
			color: inherit;
		}
	}

	&.done {
		> ul > li {
			cursor: default;
		}
	}
}
</style>
