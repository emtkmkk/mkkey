import * as os from "@/os";
import { i18n } from "@/i18n";
import { mainRouter } from "@/router";
import { defaultStore } from "@/store";

export async function sleep() {
	const { canceled } = await os.yesno({
		type: "question",
		title: i18n.ts.sleepConfirm,
		text: i18n.ts.sleepText,
	});
	if (canceled) return;

	const { canceled: canceled2, result: period } = await os.select({
		title: i18n.ts.sleepPeriod,
		items: [
			{
				value: "1min",
				text: "1分",
			},
			{
				value: "3min",
				text: "3分",
			},
			{
				value: "5min",
				text: "5分",
			},
			{
				value: "10min",
				text: "10分",
			},
			{
				value: "15min",
				text: "15分",
			},
			{
				value: "20min",
				text: "20分",
			},
			{
				value: "25min",
				text: "25分",
			},
			{
				value: "30min",
				text: "30分",
			},
			{
				value: "45min",
				text: "45分",
			},
			{
				value: "60min",
				text: "60分",
			},
			{
				value: "2hour",
				text: "2時間",
			},
			{
				value: "3hour",
				text: "3時間",
			},
			{
				value: "4hour",
				text: "4時間",
			},
			{
				value: "5hour",
				text: "5時間",
			},
			{
				value: "6hour",
				text: "6時間",
			},
		],
		default: defaultStore.state.defaultSleepTime,
	});
	if (canceled2) return;

	defaultStore.set("defaultSleepTime", period);

	const date = new Date();

	const time = period?.endsWith("min")
		? parseInt(period.replace("min", ""))
		: parseInt(period.replace("hour", "")) * 60;

	date.setMinutes(date.getMinutes() + time);

	localStorage.setItem("sleepTime", date.toISOString());

	localStorage.setItem("openCount", "0");

	if (defaultStore.state.postStartSleep) {
		let visibility = defaultStore.state.rememberNoteVisibility
			? defaultStore.state.visibility
			: defaultStore.state.defaultNoteVisibility;

		if ($i.isMiniSilenced && visibility === "public") {
			visibility = "home";
		}
		await os.apiWithDialog("notes/create", {
			text: `#睡眠モード を開始しました！（${period
				.replace("min", "分")
				.replace("hour", "時間")}） #おやすみなさい`,
			visibility,
			localOnly: defaultStore.state.rememberNoteVisibility
				? defaultStore.state.localAndFollower
				: defaultStore.state.defaultNoteLocalAndFollower,
		});
	}

	location.reload();
}
