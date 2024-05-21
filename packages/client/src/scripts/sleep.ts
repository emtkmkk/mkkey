import * as os from "@/os";
import { i18n } from "@/i18n";
import { mainRouter } from "@/router";

export async function sleep() {
	const { canceled } = await os.yesno({
		type: "question",
		title: i18n.ts.sleepConfirm,
		text: i18n.ts.sleepText
	});
	if (canceled) return;

	const date = new Date();

	date.setMinutes(date.getMinutes() + 120);

	localStorage.setItem("sleepTime", date.toISOString());

	localStorage.setItem("openCount", 0);

	location.reload();

}
