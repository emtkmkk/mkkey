<template>
	<MkModalWindow
		ref="dialogRef"
		:width="440"
		:with-ok-button="true"
		:ok-button-disabled="selected == null"
		@close="dialogRef?.close()"
		@closed="emit('closed')"
		@ok="apply()"
	>
		<template #header>どう使ってほしいですか？</template>
		<div :class="$style.root">
			<p :class="$style.caption">
				近いものを選ぶと、コピー可否とライセンスが入ります。<br />あとから変えられます。
			</p>

			<button
				v-for="preset in EMOJI_LICENSE_PRESETS"
				:key="preset.key"
				class="_button"
				:class="[$style.card, { [$style.selected]: selectedKey === preset.key }]"
				@click="select(preset)"
			>
				<div :class="$style.cardTitle">
					<i :class="`ph-${preset.icon} ph-bold ph-lg`"></i>
					{{ preset.title }}
				</div>
				<div :class="$style.cardDescription">{{ preset.description }}</div>
				<div v-if="preset.note" :class="$style.cardNote">
					<i class="ph-info ph-bold"></i> {{ preset.note }}
				</div>
				<div :class="$style.badges">
					<span
						v-for="badge in badgesOf(preset)"
						:key="badge.label"
						:class="[$style.badge, $style[badge.kind]]"
					>
						<i v-if="badge.kind === 'ok'" class="ph-check ph-bold"></i>
						<i v-else-if="badge.kind === 'ng'" class="ph-x ph-bold"></i>
						{{ badge.label }}
					</span>
				</div>
			</button>

			<div :class="$style.ask">
				<div>
					<div :class="$style.askTitle">コピーする前に一声かけてほしい</div>
					<div :class="$style.caption">
						{{
							selected == null || selected.allowAsk
								? "上で選んだ条件に加えて、ほかのサーバーへコピーする前に許可を取ってもらいます"
								: "この組み合わせでは使えません"
						}}
					</div>
				</div>
				<MkSwitch v-model="ask" :disabled="selected != null && !selected.allowAsk" />
			</div>

			<MkButton primary full :disabled="selected == null" :class="$style.apply" @click="apply()">
				この内容で設定する
			</MkButton>
		</div>
	</MkModalWindow>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 *
 * 絵文字の申請画面の［どう使ってほしいかで選ぶ］パネル。
 *
 * @remarks
 * ライセンスがよく分からない人でも、「どう使ってほしいか」のカードを選ぶだけでコピー可否とライセンスをまとめて決められるようにする（M1）。
 * - 他の設定ダイアログと同じウィンドウ（MkModalWindow）で開く。右上の ✓ か、下の［この内容で設定する］で決める
 * - 「コピーする前に一声かけてほしい」スイッチは、コピーを許すカードとだけ組み合わせられる（M4）。
 *   入れると札の「コピー」が「コピー（要許可）」に変わる
 * - ［この内容で設定する］で done を返して閉じる。設定した値は、申請画面で手で変えられる
 * カードの中身は {@link "@/scripts/emoji-license"} の EMOJI_LICENSE_PRESETS。
 *
 * @internal
 */
import { computed, ref, watch } from "vue";
import MkModalWindow from "@/components/MkModalWindow.vue";
import MkButton from "@/components/MkButton.vue";
import MkSwitch from "@/components/form/switch.vue";
import {
	EMOJI_LICENSE_PRESETS,
	type EmojiLicensePreset,
} from "@/scripts/emoji-license";

const props = defineProps<{
	/** 前に選んだカード（開き直したときに選んだ状態から始める） */
	initialKey?: string | null;
	/** 前に選んだ「一声かけてほしい」 */
	initialAsk?: boolean;
}>();

const emit = defineEmits<{
	(ev: "done", v: { preset: EmojiLicensePreset; ask: boolean }): void;
	(ev: "closed"): void;
}>();

const dialogRef = ref<InstanceType<typeof MkModalWindow>>();
const selectedKey = ref<string | null>(props.initialKey ?? null);
const ask = ref(props.initialAsk ?? false);

const selected = computed(
	() => EMOJI_LICENSE_PRESETS.find((p) => p.key === selectedKey.value) ?? null,
);

// 一声かけられないカードに変えたら、スイッチは切る
watch(selected, (p) => {
	if (p && !p.allowAsk) ask.value = false;
});

/**
 * カードを選ぶ。
 *
 * @param preset - 選んだカード
 */
function select(preset: EmojiLicensePreset): void {
	selectedKey.value = preset.key;
}

/**
 * 札を返す。選んでいるカードで「一声かけてほしい」が入っていれば、コピーの札を「要許可」にする。
 *
 * @param preset - カード
 * @returns 表示する札
 */
function badgesOf(preset: EmojiLicensePreset) {
	if (!(ask.value && selectedKey.value === preset.key)) return preset.badges;
	return preset.badges.map((b) =>
		b.label.includes("コピー") ? { kind: "cond" as const, label: "コピー（要許可）" } : b,
	);
}

/** 選んだ内容で閉じる */
function apply(): void {
	if (selected.value == null) return;
	emit("done", { preset: selected.value, ask: ask.value });
	dialogRef.value?.close();
}
</script>

<style lang="scss" module>
.root {
	padding: 12px 16px 16px;
}





.caption {
	margin: 4px 0 0;
	font-size: 0.85em;
	opacity: 0.7;
	line-height: 1.6;
}

.card {
	display: block;
	width: 100%;
	text-align: left;
	margin: 8px 0 0;
	padding: 8px 10px;
	border: solid 1px var(--divider);
	border-radius: 10px;
}

.selected {
	border: solid 2px var(--accent);
	padding: 7px 9px;
}

.cardTitle {
	display: flex;
	align-items: center;
	gap: 6px;
	font-weight: bold;
}

.cardDescription {
	margin: 2px 0 0;
	font-size: 0.85em;
	opacity: 0.8;
	line-height: 1.5;
}

.cardNote {
	margin: 3px 0 0;
	font-size: 0.8em;
	opacity: 0.6;
	line-height: 1.5;
}

.badges {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	margin: 6px 0 0;
}

.badge {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: 1px 6px;
	border-radius: 6px;
	font-size: 0.75em;
}

.ok {
	background: var(--success);
	color: #fff;
}

.ng {
	background: var(--error);
	color: #fff;
}

.cond {
	background: var(--warn);
	color: #fff;
}

.info {
	background: var(--buttonBg);
}

.ask {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 12px 0 0;
	padding: 10px;
	border-radius: 10px;
	background: var(--buttonBg);
}

.askTitle {
	font-weight: bold;
}

.apply {
	margin: 12px 0 0;
}
</style>
