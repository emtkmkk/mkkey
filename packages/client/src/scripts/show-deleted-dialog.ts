import * as os from "@/os";
import { i18n } from "@/i18n";

export function showDeletedDialog() {
	return os.alert({
		type: "error",
		title: i18n.ts.yourAccountDeletedTitle,
		text: i18n.ts.yourAccountDeletedDescription,
	});
}
