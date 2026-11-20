<template>
	<time
		:title="typeof time === 'number' ? Math.floor(time / 1000) : absolute"
		v-tooltip="
			typeof time === 'number' ? Math.floor(time / 1000) : absolute
		"
	>
		<template v-if="Number.isNaN(_time.getTime())">？？？</template>
		<template v-else-if="mode === 'relative' && dateOnly">{{
			relativeDateOnly
		}}</template>
		<template v-else-if="mode === 'relative'">{{ relative }}</template>
		<template v-else-if="mode === 'absolute' && dateOnly">{{
			absoluteDateOnly
		}}</template>
		<template v-else-if="mode === 'absolute'"
			>{{ absolute
			}}<span style="font-size: 0.75em" v-if="milliseconds">{{
				milliseconds
			}}</span></template
		>
		<template
			v-else-if="
				mode === 'detail-dateOnly' || (mode === 'detail' && dateOnly)
			"
			>{{ absoluteDateOnly }} ({{ relativeRawDateOnly }})</template
		>
		<template v-else-if="mode === 'detail' && countdown && !done">{{
			countdownTime
		}}</template>
		<template v-else-if="mode === 'detail'"
			>{{ absolute }} ({{ relativeRaw }})</template
		>
		<slot></slot>
	</time>
</template>

<script lang="ts" setup>
/**
 * @packageDocumentation
 * 相対時刻・絶対時刻・カウントダウンを表示する。
 * @remarks 更新間隔は表示ごとに保ち、予約は共有する。非表示やキャッシュ退避中は定期更新しない。
 * @see {@link registerTimeTick}
 * @internal
 */
import { onMounted, onUnmounted, onActivated, onDeactivated } from "vue";
import { i18n } from "@/i18n";
import { registerTimeTick } from "@/scripts/shared-time-ticker";

const props = withDefaults(
	defineProps<{
		time: Date | string;
		mode?: "relative" | "absolute" | "detail" | "detail-dateOnly" | "none";
		dateOnly?: boolean;
		countdown?: boolean;
	}>(),
	{
		mode: "relative",
		dateOnly: false,
		countdown: false,
	}
);

const _time =
	props.mode === "detail-dateOnly" || props.dateOnly
		? typeof props.time === "string" || typeof props.time === "number"
			? new Date(new Date(props.time).setHours(0, 0, 0, 0))
			: new Date(props.time.setHours(0, 0, 0, 0))
		: typeof props.time === "string" || typeof props.time === "number"
		? new Date(props.time)
		: props.time;
const absolute = Number.isNaN(_time.getTime())
	? props.time
	: _time.getFullYear() < 0
	? `${-_time.getFullYear()} B.C.`
	: _time.toLocaleString();
const milliseconds = _time.getMilliseconds()
	? `.${`000${_time.getMilliseconds()}`.slice(-3)}`
	: "";
const absoluteDateOnly = Number.isNaN(_time.getTime())
	? props.time
	: _time.getFullYear() < 0
	? `${-_time.getFullYear()} B.C.`
	: _time.toLocaleDateString();

let now = $ref(new Date());
let done = $ref(false);
const ago = $computed(() => (now.getTime() - _time.getTime()) / 1000 /*ms*/);

const relative = $computed(() => {
	return now.getFullYear() !== _time.getFullYear()
		? _time.toLocaleString([], {
				year: "numeric",
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				minute: "numeric",
				hour12: false,
		  })
		: ago >= 60 * 60 * 24
		? _time.toLocaleString([], {
				month: "numeric",
				day: "numeric",
				hour: "numeric",
				minute: "numeric",
				hour12: false,
		  })
		: ago >= 3600
		? _time.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
				hour12: false,
		  })
		: ago >= 60
		? i18n.t("_ago.minutesAgo", { n: (~~(ago / 60)).toString() })
		: ago >= 3
		? i18n.t("_ago.secondsAgo", { n: (~~(ago % 60)).toString() })
		: i18n.ts._ago.justNow;
});

const relativeRaw = $computed(() => {
	if (ago <= -3) {
		const agoAbs = -ago;
		return agoAbs >= 31536000
			? i18n.t("_timeIn.years", { n: (~~(agoAbs / 31536000)).toString() })
			: agoAbs >= 2592000
			? i18n.t("_timeIn.months", { n: (~~(agoAbs / 2592000)).toString() })
			: agoAbs >= 604800
			? i18n.t("_timeIn.weeks", { n: (~~(agoAbs / 604800)).toString() })
			: agoAbs >= 86400
			? i18n.t("_timeIn.days", { n: (~~(agoAbs / 86400)).toString() })
			: agoAbs >= 3600
			? i18n.t("_timeIn.hours", { n: (~~(agoAbs / 3600)).toString() })
			: agoAbs >= 60
			? i18n.t("_timeIn.minutes", { n: (~~(agoAbs / 60)).toString() })
			: agoAbs >= 3
			? i18n.t("_timeIn.seconds", { n: (~~(agoAbs % 60)).toString() })
			: i18n.ts._ago.justNow;
	} else {
		return ago >= 31536000
			? i18n.t("_ago.yearsAgo", { n: (~~(ago / 31536000)).toString() })
			: ago >= 2592000
			? i18n.t("_ago.monthsAgo", { n: (~~(ago / 2592000)).toString() })
			: ago >= 604800
			? i18n.t("_ago.weeksAgo", { n: (~~(ago / 604800)).toString() })
			: ago >= 86400
			? i18n.t("_ago.daysAgo", { n: (~~(ago / 86400)).toString() })
			: ago >= 3600
			? i18n.t("_ago.hoursAgo", { n: (~~(ago / 3600)).toString() })
			: ago >= 60
			? i18n.t("_ago.minutesAgo", { n: (~~(ago / 60)).toString() })
			: ago >= 3
			? i18n.t("_ago.secondsAgo", { n: (~~(ago % 60)).toString() })
			: i18n.ts._ago.justNow;
	}
});

const relativeDateOnly = $computed(() => {
	return now.getFullYear() !== _time.getFullYear()
		? _time.toLocaleString([], {
				year: "numeric",
				month: "numeric",
				day: "numeric",
		  })
		: _time.toLocaleString([], { month: "numeric", day: "numeric" });
});

const relativeRawDateOnly = $computed(() => {
	return i18n.t("_ago.daysAgo", { n: (~~(ago / 86400)).toString() });
});

const countdownTime = $computed(() => {
	if (ago >= 0) return i18n.ts.countdownDone;
	const agoAbs = -ago;
	return `${agoAbs >= 3600 ? `${~~(agoAbs / 3600)}:` : ""}${
		agoAbs >= 3600
			? ("00" + (~~(agoAbs / 60) % 60)).slice(-2)
			: ~~(agoAbs / 60) % 60
	}:${("00" + ~~(agoAbs % 60)).slice(-2)}`;
});

//#region 共有時計への登録

/** 有効な表示だけを共有時計へ登録するための解除関数。 @internal */
let stopTick: (() => void) | null = null;

/**
 * 実時刻を反映して、従来と同じ更新間隔を返す。
 * @remarks カウントダウン500ms、直近10秒、1時間以内30秒、それ以外5分を維持する。
 * @returns 次回更新までのミリ秒
 * @internal
 */
function tick(): number {
	now = new Date();
	return (
		props.countdown && ago < 0
			? 500
			: ago < 60 && ago > -60
			? 10000
			: ago < 3600 && ago > -3600
			? 30000
			: 300000
	);
}

/** 表示の更新を開始する。 @remarks 初回のonActivatedとの二重登録を防ぐ。 @returns なし @internal */
function startTick(): void {
	if (stopTick === null) stopTick = registerTimeTick(tick);
}

/** 表示の更新を止める。 @remarks 復帰時はstartTickで実時刻へ更新する。 @returns なし @internal */
function pauseTick(): void {
	stopTick?.();
	stopTick = null;
}

if (
	props.mode === "relative" ||
	props.mode === "detail" ||
	props.mode === "detail-dateOnly"
) {
	onMounted(() => {
		if (props.countdown && ago >= 0) done = true;
		startTick();
	});

	onActivated(startTick);
	onDeactivated(pauseTick);
	onUnmounted(pauseTick);
}

//#endregion
</script>
