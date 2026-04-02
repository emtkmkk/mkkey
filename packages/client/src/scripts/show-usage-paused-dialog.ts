import * as os from "@/os";
import { i18n } from "@/i18n";

export function showUsagePausedDialog() {
	return os.alert({
		type: "error",
		title: i18n.ts.yourAccountUsagePausedTitle,
		text: i18n.ts.yourAccountUsagePausedDescription,
	});
}
