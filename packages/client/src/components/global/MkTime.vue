<template>
	<time :title="absolute" v-tooltip="absolute">
		<template v-if="Number.isNaN(_time.getTime())">？？？</template>
		<template v-else-if="mode === 'relative' && dateOnly">{{ relativeDateOnly }}</template>
		<template v-else-if="mode === 'relative'">{{ relative }}</template>
		<template v-else-if="mode === 'absolute' && dateOnly">{{ absoluteDateOnly }}</template>
		<template v-else-if="mode === 'absolute'">{{ absolute }}<span style="font-size: 0.75em" v-if="milliseconds">{{ milliseconds }}</span></template>
		<template v-else-if="mode === 'detail-dateOnly' || mode === 'detail' && dateOnly"
			>{{ absoluteDateOnly }} ({{ relativeRawDateOnly }})</template
		>
		<template v-else-if="mode === 'detail'"
			>{{ absolute }} ({{ relativeRaw }})</template
		>
		<slot></slot>
	</time>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted } from "vue";
import { i18n } from "@/i18n";

const props = withDefaults(
	defineProps<{
		time: Date | string;
		mode?: "relative" | "absolute" | "detail" | "detail-dateOnly" | "none";
		dateOnly?: boolean;
	}>(),
	{
		mode: "relative",
		dateOnly: false,
	}
);

const _time = (props.mode === "detail-dateOnly" || props.dateOnly)
				? typeof props.time === "string" || typeof props.time === "number" ? new Date(new Date(props.time).setHours(0, 0, 0, 0)) : new Date(props.time.setHours(0, 0, 0, 0))
				: typeof props.time === "string" || typeof props.time === "number" ? new Date(props.time) : props.time;
const absolute = Number.isNaN(_time.getTime()) ? props.time : _time.getFullYear() < 0 ? `${-(_time.getFullYear())} D.C.` : _time.toLocaleString();
const milliseconds = _time.getMilliseconds() ? "." + ("000" + _time.getMilliseconds()).slice(-3) : "";
const absoluteDateOnly = Number.isNaN(_time.getTime()) ? props.time : _time.getFullYear() < 0 ? `${-(_time.getFullYear())} D.C.` : _time.toLocaleDateString();

let now = $ref((new Date()));
const ago = $computed(() => (now.getTime() - _time.getTime()) / 1000/*ms*/);

const relative = $computed(() => {
	return now.getFullYear() !== _time.getFullYear()
		? _time.toLocaleString([], { year:'numeric' , month: 'numeric' , day: 'numeric' , hour: 'numeric' , minute: 'numeric', hour12: false })
		: ago >= (60 * 60 * 24)
		? _time.toLocaleString([], { month: 'numeric' , day: 'numeric' , hour: 'numeric' , minute: 'numeric', hour12: false })
		: ago >= 3600
		? _time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' , hour12: false })
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
		? _time.toLocaleString([], { year:'numeric' , month: 'numeric' , day: 'numeric' })
		: _time.toLocaleString([], { month: 'numeric' , day: 'numeric' });
});

const relativeRawDateOnly = $computed(() => {
	return i18n.t("_ago.daysAgo", { n: (~~(ago / 86400)).toString() })
});

let tickId: number;
let currentInterval: number;

function tick() {
	now = new Date();
	const nextInterval = ago < 60 ? 10000 : ago < 3600 ? 30000 : 300000;

	if (currentInterval !== nextInterval) {
		if (tickId) window.clearInterval(tickId);
		currentInterval = nextInterval;
		tickId = window.setInterval(tick, nextInterval);
	}
}

if (props.mode === "relative" || props.mode === "detail" || props.mode === "detail-dateOnly") {
	onMounted(() => {
		tick();
	});

	onUnmounted(() => {
		if (tickId) window.clearInterval(tickId);
	});
}
</script>
