<template>
	<div class="mkw-calendar" :class="{ _panel: !widgetProps.transparent }">
		<div class="calendar" :class="{ isHoliday }">
			<p class="month-and-year">
				<span class="year">{{ i18n.t("yearX", { year }) }}</span>
				<span class="month">{{ i18n.t("monthX", { month }) }}</span>
			</p>
			<p v-if="month === 1 && day === 1" class="day">
				🎉{{ i18n.t("dayX", { day })
				}}<span style="display: inline-block; transform: scaleX(-1)"
					>🎉</span
				>
			</p>
			<p v-else class="day">{{ i18n.t("dayX", { day }) }}</p>
			<p class="week-day">{{ weekDay }}</p>
		</div>
		<div class="info">
			<div>
				<p>
					{{ i18n.ts.today }}: <b>{{ dayP.toFixed(1) }}%</b>
				</p>
				<div class="meter">
					<div class="val" :style="{ width: `${dayP}%` }"></div>
				</div>
			</div>
			<div>
				<p>
					{{ i18n.ts.thisMonth }}: <b>{{ monthP.toFixed(1) }}%</b>
				</p>
				<div class="meter">
					<div class="val" :style="{ width: `${monthP}%` }"></div>
				</div>
			</div>
			<div>
				<p>
					{{ i18n.ts.thisYear }}: <b>{{ yearP.toFixed(1) }}%</b>
				</p>
				<div class="meter">
					<div class="val" :style="{ width: `${yearP}%` }"></div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onUnmounted, ref } from "vue";
import {
	useWidgetPropsManager,
	Widget,
	WidgetComponentEmits,
	WidgetComponentExpose,
	WidgetComponentProps,
} from "./widget";
import { GetFormResultType } from "@/scripts/form";
import { i18n } from "@/i18n";
import { useInterval } from "@/scripts/use-interval";

const name = "calendar";

const widgetPropsDef = {
	transparent: {
		type: "boolean" as const,
		default: false,
	},
	logicalDate: {
		type: "boolean" as const,
		default: false,
	},
};

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

// 現時点ではvueの制限によりimportしたtypeをジェネリックに渡せない
//const props = defineProps<WidgetComponentProps<WidgetProps>>();
//const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();
const props = defineProps<{ widget?: Widget<WidgetProps> }>();
const emit = defineEmits<{ (ev: "updateProps", props: WidgetProps) }>();

const { widgetProps, configure } = useWidgetPropsManager(
	name,
	widgetPropsDef,
	props,
	emit
);

const year = ref(0);
const month = ref(0);
const day = ref(0);
const weekDay = ref("");
const yearP = ref(0);
const monthP = ref(0);
const dayP = ref(0);
const isHoliday = ref(false);
const tick = () => {
	const now = new Date();
	const nd = now.getDate();
	const nm = now.getMonth();
	const ny = now.getFullYear();

	// logical
	const nowl = new Date(now - 1000 * 60 * 60 * 6);
	const ndl = nowl.getDate();
	const nml = nowl.getMonth();
	const nyl = nowl.getFullYear();

	year.value = ny;
	month.value = nm + 1;
	day.value = nd;
	weekDay.value = [
		i18n.ts._weekday.sunday,
		i18n.ts._weekday.monday,
		i18n.ts._weekday.tuesday,
		i18n.ts._weekday.wednesday,
		i18n.ts._weekday.thursday,
		i18n.ts._weekday.friday,
		i18n.ts._weekday.saturday,
	][now.getDay()];

	const dayNumer = widgetProps.logicalDate
		? nowl.getTime() - new Date(nyl, nml, ndl).getTime()
		: now.getTime() - new Date(ny, nm, nd).getTime();
	const dayDenom = 1000 /*ms*/ * 60 /*s*/ * 60 /*m*/ * 24; /*h*/
	const monthNumer = now.getTime() - new Date(ny, nm, 1).getTime();
	const monthDenom =
		new Date(ny, nm + 1, 1).getTime() - new Date(ny, nm, 1).getTime();
	const yearNumer = now.getTime() - new Date(ny, 0, 1).getTime();
	const yearDenom =
		new Date(ny + 1, 0, 1).getTime() - new Date(ny, 0, 1).getTime();

	dayP.value = (dayNumer / dayDenom) * 100;
	monthP.value = (monthNumer / monthDenom) * 100;
	yearP.value = (yearNumer / yearDenom) * 100;

	isHoliday.value = now.getDay() === 0 || now.getDay() === 6;
};

useInterval(tick, 1000, {
	immediate: true,
	afterMounted: false,
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" scoped>
.mkw-calendar {
	padding: 1rem 0;

	&:after {
		content: "";
		display: block;
		clear: both;
	}

	> .calendar {
		float: left;
		width: 60%;
		text-align: center;

		&.isHoliday {
			> .day {
				color: #ef95a0;
			}
		}

		> .month-and-year,
		> .week-day {
			margin: 0;
			line-height: 1.125rem;
			font-size: 0.9em;

			> .year,
			> .month {
				margin: 0 0.25rem;
			}
		}

		> .day {
			margin: 0.625rem 0;
			line-height: 2rem;
			font-size: 1.75em;
		}
	}

	> .info {
		display: block;
		float: left;
		width: 40%;
		padding: 0 1rem 0 0;
		box-sizing: border-box;

		> div {
			margin-bottom: 0.5rem;

			&:last-child {
				margin-bottom: 0.25rem;
			}

			> p {
				margin: 0 0 0.125rem 0;
				font-size: 0.75em;
				line-height: 1.125rem;
				opacity: 0.8;

				> b {
					margin-left: 0.125rem;
				}
			}

			> .meter {
				width: 100%;
				overflow: hidden;
				background: var(--X11);
				border-radius: 0.5rem;

				> .val {
					height: 0.25rem;
					transition: width 0.3s cubic-bezier(0.23, 1, 0.32, 1);
				}
			}

			&:nth-child(1) {
				> .meter > .val {
					background: #eb6f92;
				}
			}

			&:nth-child(2) {
				> .meter > .val {
					background: #ebbcba;
				}
			}

			&:nth-child(3) {
				> .meter > .val {
					background: #c4a7e7;
				}
			}
		}
	}
}
</style>
